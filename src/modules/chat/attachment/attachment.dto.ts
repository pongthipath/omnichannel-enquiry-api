import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { signAttachmentPath } from './attachment-url.util';
import { AttachmentKind, AttachmentStatus, ChatMessageAttachment } from './chat-message-attachment.entity';

export class AttachmentDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ enum: AttachmentKind }) kind: AttachmentKind;
  @ApiProperty({ example: 'expiry-date.jpg' }) fileName: string;
  @ApiProperty({ example: 'image/jpeg' }) mimeType: string;
  @ApiProperty() sizeBytes: number;
  @ApiProperty({
    example: '/attachments/1f…/file?t=1790216000000.aGVsbG8',
    description: 'served through the API and signed, so an <img> can load it without a header',
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
      url: signAttachmentPath(a.id),
      status: a.status,
      chatMessageId: a.chatMessageId,
    };
  }
}
