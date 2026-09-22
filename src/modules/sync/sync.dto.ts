import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsIn,
  IsObject,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export type SyncOp = 'conversation.create' | 'message.create';

export class SyncItemDto {
  @ApiProperty({ enum: ['conversation.create', 'message.create'] })
  @IsIn(['conversation.create', 'message.create'])
  op: SyncOp;

  @ApiProperty({
    format: 'uuid',
    description: 'idempotency key created on the device (clientRequestId / clientMessageId)',
  })
  @IsUUID()
  clientId: string;

  @ApiProperty({
    type: Object,
    description:
      'conversation.create → CreateEnquiryDto fields · message.create → { conversationId, body }',
  })
  @IsObject()
  payload: Record<string, unknown>;
}

export class SyncRequestDto {
  @ApiProperty({ type: [SyncItemDto], maxItems: 50 })
  @ValidateNested({ each: true })
  @Type(() => SyncItemDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  items: SyncItemDto[];
}

export class SyncResultDto {
  @ApiProperty({ format: 'uuid' }) clientId: string;
  @ApiProperty({ enum: ['created', 'duplicate', 'failed'] }) status:
    'created' | 'duplicate' | 'failed';
  @ApiPropertyOptional({ format: 'uuid' }) serverId?: string;
  @ApiPropertyOptional({ example: 'ENQ-2026-000123' }) reference?: string;
  @ApiPropertyOptional({ description: 'error code (i18n key)' }) error?: string;
  @ApiPropertyOptional({ description: 'false = do not retry (validation / permission error)' })
  retryable?: boolean;
}

export class SyncResponseDto {
  @ApiProperty({ type: [SyncResultDto] }) results: SyncResultDto[];
}
