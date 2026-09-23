import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AttachmentKind, AttachmentStatus, ChatMessageAttachment } from './chat-message-attachment.entity';

export class AttachmentDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ enum: AttachmentKind }) kind: AttachmentKind;
  @ApiProperty({ example: 'expiry-date.jpg' }) fileName: string;
  @ApiProperty({ example: 'image/jpeg' }) mimeType: string;
  @ApiProperty() sizeBytes: number;
  @ApiProperty({
    example: '/api/v1/attachments/1f…/file',
    description: 'always served through the API, so the bucket stays private',
  })
  url: string;
  @ApiProperty({ enum: AttachmentStatus, description: 'PENDING = still on the channel, being mirrored' })
  status: AttachmentStatus;
  @ApiPropertyOptional({ nullable: true }) chatMessageId: string | null;

  static from(a: ChatMessageAttachment): AttachmentDto {
    return {
      id: a.id,
      kind: a.kind,
      fileName: a.fileName,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
      url: `/attachments/${a.id}/file`,
      status: a.status,
      chatMessageId: a.chatMessageId,
    };
  }
}
