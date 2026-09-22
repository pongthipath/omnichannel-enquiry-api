import { CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Chat } from '../enquiry/chat.entity';
import { Tag } from './tag.entity';

/** Which tags an enquiry has. Parent (chat) → child (tag) naming; the pair is the key, so no duplicates. */
@Entity('chat_tag')
@Index('idx_chat_tag__tag_id', ['tagId'])
export class ChatTag {
  @PrimaryColumn({ type: 'uuid', primaryKeyConstraintName: 'pk_chat_tag' })
  chatId: string;

  @PrimaryColumn({ type: 'uuid', primaryKeyConstraintName: 'pk_chat_tag' })
  tagId: string;

  @ManyToOne(() => Chat, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'chat_id', foreignKeyConstraintName: 'fk_chat_tag__chat_id' })
  chat: Chat;

  @ManyToOne(() => Tag, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tag_id', foreignKeyConstraintName: 'fk_chat_tag__tag_id' })
  tag: Tag;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
