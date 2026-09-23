import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Response } from 'express';
import { Actor } from '../../../common/auth/actor';
import { CurrentActor, Public } from '../../../common/auth/auth.decorators';
import { ApiErrorDto } from '../../../common/dto/api-error.dto';
import { verifyAttachmentToken } from './attachment-url.util';
import { AttachmentDto } from './attachment.dto';
import { AttachmentService, MAX_UPLOAD_BYTES } from './attachment.service';

@ApiTags('Attachments')
@ApiBearerAuth()
@Controller('attachments')
export class AttachmentController {
  constructor(private readonly attachments: AttachmentService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @ApiOperation({
    summary: 'Upload a file, then send its id with the message (images ≤ 10 MB, jpeg/png/gif/webp/heic, pdf, txt)',
  })
  @ApiCreatedResponse({ type: AttachmentDto })
  @ApiBadRequestResponse({ type: ApiErrorDto, description: 'attachment.tooLarge · attachment.unsupportedType' })
  upload(@CurrentActor() actor: Actor, @UploadedFile() file: Express.Multer.File): Promise<AttachmentDto> {
    return this.attachments.upload(actor, file);
  }

  /**
   * Public by signature, not by bearer token: an `<img>` / `<Image>` cannot send a header. Who may
   * see the file was decided when the message was served — only a reader of that message was given
   * this link. It is tied to one attachment and expires, and the bucket itself stays private.
   */
  @Get(':id/file')
  @Public()
  @ApiOperation({ summary: 'The file itself — open the signed url that came with the message' })
  @ApiOkResponse({ description: 'the file bytes' })
  @ApiUnauthorizedResponse({ type: ApiErrorDto, description: 'attachment.badLink (missing, wrong or expired)' })
  async file(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('t') token: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    if (!verifyAttachmentToken(id, token)) throw new UnauthorizedException('attachment.badLink');
    const attachment = await this.attachments.getById(id);
    const { stream, mimeType } = await this.attachments.openStream(attachment);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(attachment.fileName)}"`);
    stream.pipe(res);
  }
}
