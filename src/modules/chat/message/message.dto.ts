import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Channel, MessageType, SenderType } from '../../../common/constants/enums';
import { AttachmentDto } from '../attachment/attachment.dto';
import { ChatMessageAttachment } from '../attachment/chat-message-attachment.entity';
import { ChatMessage } from './chat-message.entity';

export class SendMessageDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Idempotency key generated on the device' })
  @IsOptional()
  @IsUUID()
  clientMessageId?: string;

  @ApiProperty({ example: 'ส่งรูปวันหมดอายุให้แล้วค่ะ', maxLength: 5000, description: 'may be empty when files are attached' })
  @IsString()
  @MaxLength(5000)
  body: string;

  @ApiPropertyOptional({ type: [String], description: 'ids from POST /attachments (max 5)' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsUUID('all', { each: true })
  attachmentIds?: string[];

  @ApiPropertyOptional({
    default: false,
    description: 'staff only: internal note, hidden from the customer',
  })
  @IsOptional()
  @IsBoolean()
  isInternal?: boolean;
}

export class ListMessagesQuery {
  @ApiPropertyOptional({ format: 'uuid', description: 'id of the oldest message already loaded' })
  @IsOptional()
  @IsUUID()
  before?: string;

  @ApiPropertyOptional({ default: 30, maximum: 100 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class MessageDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) chatId: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) clientMessageId: string | null;
  @ApiProperty({ enum: Channel }) channel: Channel;
  @ApiProperty({ enum: SenderType }) senderType: SenderType;
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) senderId: string | null;
  @ApiProperty({ enum: MessageType }) messageType: MessageType;
  @ApiPropertyOptional({ nullable: true }) body: string | null;
  @ApiPropertyOptional({ nullable: true, type: Object }) eventData: Record<string, unknown> | null;
  @ApiProperty() isInternal: boolean;
  @ApiPropertyOptional({ nullable: true }) deliveredAt: Date | null;
  @ApiPropertyOptional({ nullable: true }) readAt: Date | null;
  @ApiProperty() createdAt: Date;
  @ApiPropertyOptional({ nullable: true, example: 'สุดา (CS)', description: 'staff name or customer contact' })
  senderName: string | null;
  @ApiProperty({ type: [AttachmentDto] }) attachments: AttachmentDto[];

  static from(m: ChatMessage, senderName: string | null = null, attachments: ChatMessageAttachment[] = []): MessageDto {
    return {
      id: m.id,
      chatId: m.chatId,
      clientMessageId: m.clientMessageId,
      channel: m.channel,
      senderType: m.senderType,
      senderId: m.senderId,
      senderName,
      attachments: attachments.map(AttachmentDto.from),
      messageType: m.messageType,
      body: m.body,
      eventData: m.eventData,
      isInternal: m.isInternal,
      deliveredAt: m.deliveredAt,
      readAt: m.readAt,
      createdAt: m.createdAt,
    };
  }
}

export class MessagePageDto {
  @ApiProperty({ type: [MessageDto] }) items: MessageDto[];
  @ApiPropertyOptional({ nullable: true }) nextCursor: string | null;
}

export class SendMessageResultDto {
  @ApiProperty({ type: MessageDto }) message: MessageDto;
  @ApiProperty({ description: 'false = idempotent replay of an already stored message' })
  created: boolean;
}
