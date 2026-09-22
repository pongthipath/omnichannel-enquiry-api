import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { ChatMessage } from './chat-message.entity';

@Injectable()
export class ChatMessageRepository {
  constructor(@InjectRepository(ChatMessage) private readonly repo: Repository<ChatMessage>) {}

  /** ON CONFLICT (chat_id, client_message_id) DO NOTHING — null when the message already existed. */
  async insertIgnoringDuplicate(
    manager: EntityManager,
    values: QueryDeepPartialEntity<ChatMessage>,
  ): Promise<string | null> {
    const result = await manager
      .createQueryBuilder()
      .insert()
      .into(ChatMessage)
      .values(values)
      .orIgnore()
      .returning(['id'])
      .execute();
    return (result.raw as { id: string }[])[0]?.id ?? null;
  }

  findById(id: string, manager?: EntityManager): Promise<ChatMessage | null> {
    return (manager ? manager.getRepository(ChatMessage) : this.repo).findOne({ where: { id } });
  }

  findByClientMessageId(chatId: string, clientMessageId: string, manager?: EntityManager) {
    return (manager ? manager.getRepository(ChatMessage) : this.repo).findOne({
      where: { chatId, clientMessageId },
    });
  }

  /** Newest first, keyset on (created_at, id). */
  list(chatId: string, opts: { includeInternal: boolean; beforeId?: string; limit: number }) {
    const qb = this.repo
      .createQueryBuilder('m')
      .where('m.chatId = :chatId', { chatId })
      .orderBy('m.createdAt', 'DESC')
      .addOrderBy('m.id', 'DESC')
      .take(opts.limit);
    if (!opts.includeInternal) qb.andWhere('m.isInternal = false');
    // cursor = id of the oldest message already shown; compare in SQL to keep microsecond precision
    if (opts.beforeId) {
      qb.andWhere(
        '(m.createdAt, m.id) < (SELECT c.created_at, c.id FROM chat_message c WHERE c.id = :beforeId)',
        { beforeId: opts.beforeId },
      );
    }
    return qb.getMany();
  }
}
