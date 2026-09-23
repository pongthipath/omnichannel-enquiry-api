import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
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
} from '@nestjs/swagger';
import { Response } from 'express';
import { Actor } from '../../../common/auth/actor';
import { CurrentActor } from '../../../common/auth/auth.decorators';
import { ApiErrorDto } from '../../../common/dto/api-error.dto';
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

  @Get(':id/file')
  @ApiOperation({ summary: 'The file itself (streamed through the API; the bucket stays private)' })
  @ApiOkResponse({ description: 'the file bytes' })
  async file(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const attachment = await this.attachments.getVisible(actor, id);
    const { stream, mimeType } = await this.attachments.openStream(attachment);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(attachment.fileName)}"`);
    stream.pipe(res);
  }
}
