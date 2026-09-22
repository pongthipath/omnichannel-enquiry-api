import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Channel, MessageType, SenderType } from '../../../common/constants/enums';
import { ChatMessage } from './chat-message.entity';

export class SendMessageDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Idempotency key generated on the device' })
  @IsOptional()
  @IsUUID()
  clientMessageId?: string;

  @ApiProperty({ example: 'ส่งรูปวันหมดอายุให้แล้วค่ะ', maxLength: 5000 })
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body: string;

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

  static from(m: ChatMessage): MessageDto {
    return {
      id: m.id,
      chatId: m.chatId,
      clientMessageId: m.clientMessageId,
      channel: m.channel,
      senderType: m.senderType,
      senderId: m.senderId,
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
