import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { ChatMessage } from '../message/chat-message.entity';

export enum AttachmentKind {
  IMAGE = 'IMAGE',
  FILE = 'FILE',
}

/** Where the bytes are right now (design §9: keep the URL first, mirror to S3 after). */
export enum AttachmentStatus {
  /** only the external URL is known (webhook image) — the worker will mirror it */
  PENDING = 'PENDING',
  /** stored in our own bucket; `storageKey` is set */
  STORED = 'STORED',
  /** mirroring failed for good; the external URL is still shown */
  FAILED = 'FAILED',
}

/** One file of a message: 1 message can carry several (design §5). */
@Entity('chat_message_attachment')
@Index('idx_chat_message_attachment__message_id', ['chatMessageId'])
@Index('idx_chat_message_attachment__status', ['status'])
export class ChatMessageAttachment extends BaseEntity {
  @Column({ type: 'uuid', nullable: true })
  chatMessageId: string | null;

  @ManyToOne(() => ChatMessage, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'chat_message_id',
    foreignKeyConstraintName: 'fk_chat_message_attachment__chat_message_id',
  })
  chatMessage: ChatMessage | null;

  @Column({ type: 'varchar', length: 10 })
  kind: AttachmentKind;

  @Column({ length: 200 })
  fileName: string;

  @Column({ type: 'varchar', length: 100 })
  mimeType: string;

  @Column({ type: 'int', default: 0 })
  sizeBytes: number;

  /** the channel's own URL (LINE / Facebook / any link) — shown until the mirror finishes */
  @Column({ type: 'varchar', length: 1000, nullable: true })
  sourceUrl: string | null;

  /** key inside our bucket once mirrored */
  @Column({ type: 'varchar', length: 300, nullable: true })
  storageKey: string | null;

  @Column({ type: 'varchar', length: 10, default: AttachmentStatus.PENDING })
  status: AttachmentStatus;

  @Column({ type: 'int', default: 0 })
  mirrorAttempts: number;

  @Column({ type: 'varchar', length: 300, nullable: true })
  lastError: string | null;

  /** who uploaded it, before it is attached to a message */
  @Column({ type: 'uuid', nullable: true })
  uploadedById: string | null;
}
