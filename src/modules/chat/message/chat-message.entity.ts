import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Channel, MessageType, SenderType } from '../../../common/constants/enums';
import { Chat } from '../enquiry/chat.entity';

/** Messages + system events of a chat in one timeline (design §5). Append-only: no updated_at. */
@Entity('chat_message')
@Unique('uq_chat_message__chat_id_client_message_id', ['chatId', 'clientMessageId'])
@Unique('uq_chat_message__channel_external_message_id', ['channel', 'externalMessageId'])
@Index('idx_chat_message__chat_id_created_at', ['chatId', 'createdAt'])
export class ChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  chatId: string;

  @ManyToOne(() => Chat, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'chat_id', foreignKeyConstraintName: 'fk_chat_message__chat_id' })
  chat: Chat;

  @Column({ type: 'uuid', nullable: true })
  clientMessageId: string | null;

  @Column({ type: 'varchar', length: 20 })
  channel: Channel;

  @Column({ type: 'varchar', length: 200, nullable: true })
  externalMessageId: string | null;

  @Column({ type: 'varchar', length: 10 })
  senderType: SenderType;

  /** customer.id or staff.id depending on sender_type (no FK on purpose — design §5) */
  @Column({ type: 'uuid', nullable: true })
  senderId: string | null;

  @Column({ type: 'varchar', length: 10 })
  messageType: MessageType;

  @Index('idx_chat_message__body_trgm', { synchronize: false }) // GIN trigram, hand-written migration
  @Column({ type: 'text', nullable: true })
  body: string | null;

  @Column({ type: 'jsonb', nullable: true })
  eventData: Record<string, unknown> | null;

  @Column({ default: false })
  isInternal: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  deliveredAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
