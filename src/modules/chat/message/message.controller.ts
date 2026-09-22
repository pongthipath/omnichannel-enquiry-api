import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Res } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { Actor } from '../../../common/auth/actor';
import { CurrentActor } from '../../../common/auth/auth.decorators';
import { ApiErrorDto } from '../../../common/dto/api-error.dto';
import {
  ListMessagesQuery,
  MessagePageDto,
  SendMessageDto,
  SendMessageResultDto,
} from './message.dto';
import { MessageService } from './message.service';

@ApiTags('Conversations (enquiries)')
@ApiBearerAuth()
@Controller('conversations/:id/messages')
export class MessageController {
  constructor(private readonly messages: MessageService) {}

  @Get()
  @ApiOperation({
    summary: 'Messages and events of an enquiry, newest first (internal notes need permission)',
  })
  @ApiOkResponse({ type: MessagePageDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  list(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListMessagesQuery,
  ): Promise<MessagePageDto> {
    return this.messages.list(actor, id, query);
  }

  @Post()
  @ApiOperation({
    summary: 'Send a message (idempotent with clientMessageId)',
    description: 'A customer message reopens a RESOLVED/CLOSED enquiry and resumes a WAITING one.',
  })
  @ApiCreatedResponse({ type: SendMessageResultDto })
  @ApiConflictResponse({
    type: ApiErrorDto,
    description: 'chat.closed (staff posting to a closed enquiry)',
  })
  async send(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendMessageDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SendMessageResultDto> {
    const result = await this.messages.send(actor, id, dto);
    res.status(result.created ? 201 : 200);
    return result;
  }
}
