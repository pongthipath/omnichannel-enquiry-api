import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, IsNull, LessThan, Repository } from 'typeorm';
import { AttachmentStatus, ChatMessageAttachment } from './chat-message-attachment.entity';

@Injectable()
export class AttachmentRepository {
  constructor(
    @InjectRepository(ChatMessageAttachment) private readonly repo: Repository<ChatMessageAttachment>,
  ) {}

  create(values: Partial<ChatMessageAttachment>, manager?: EntityManager): Promise<ChatMessageAttachment> {
    const repo = manager ? manager.getRepository(ChatMessageAttachment) : this.repo;
    return repo.save(repo.create(values));
  }

  findById(id: string): Promise<ChatMessageAttachment | null> {
    return this.repo.findOne({ where: { id } });
  }

  findByIds(ids: string[]): Promise<ChatMessageAttachment[]> {
    return ids.length ? this.repo.find({ where: { id: In(ids) } }) : Promise.resolve([]);
  }

  /** messageId → its files, for a page of messages (one query). */
  async findForMessages(messageIds: string[]): Promise<Map<string, ChatMessageAttachment[]>> {
    const map = new Map<string, ChatMessageAttachment[]>();
    if (!messageIds.length) return map;
    const rows = await this.repo.find({
      where: { chatMessageId: In(messageIds) },
      order: { createdAt: 'ASC' },
    });
    for (const r of rows) {
      map.set(r.chatMessageId!, [...(map.get(r.chatMessageId!) ?? []), r]);
    }
    return map;
  }

  async attachToMessage(manager: EntityManager, ids: string[], messageId: string): Promise<void> {
    if (!ids.length) return;
    await manager
      .getRepository(ChatMessageAttachment)
      .update({ id: In(ids), chatMessageId: IsNull() }, { chatMessageId: messageId });
  }

  /** Files still living on someone else's server — the worker mirrors these into our bucket. */
  pendingMirrors(limit: number, maxAttempts: number): Promise<ChatMessageAttachment[]> {
    return this.repo.find({
      where: { status: AttachmentStatus.PENDING, mirrorAttempts: LessThan(maxAttempts) },
      order: { createdAt: 'ASC' },
      take: limit,
    });
  }

  save(attachment: ChatMessageAttachment): Promise<ChatMessageAttachment> {
    return this.repo.save(attachment);
  }
}
