import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository, SelectQueryBuilder } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { Channel } from '../../../common/constants/enums';
import { Chat } from '../enquiry/chat.entity';
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

  /** Webhook retries carry the same channel message id — this returns the copy we already stored. */
  findByExternalMessageId(channel: Channel, externalMessageId: string, manager?: EntityManager) {
    return (manager ? manager.getRepository(ChatMessage) : this.repo).findOne({
      where: { channel, externalMessageId },
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
  /**
   * Every message this customer exchanged, across all their enquiries (design A9/A10). Only chats the
   * staff member may see are included — the scope is applied to the chat, exactly as in the inbox.
   * `q` narrows to messages containing the text (A10).
   */
  listForCustomer(
    customerId: string,
    opts: { includeInternal: boolean; q?: string; beforeId?: string; limit: number },
    applyScope: (qb: SelectQueryBuilder<ChatMessage>) => void,
  ) {
    const qb = this.repo
      .createQueryBuilder('m')
      .innerJoin(Chat, 'chat', 'chat.id = m.chat_id')
      .addSelect(['chat.reference AS chat_reference', 'chat.subject AS chat_subject'])
      .where('chat.customerId = :customerId', { customerId })
      .andWhere("m.messageType <> 'EVENT'")
      .orderBy('m.createdAt', 'DESC')
      .addOrderBy('m.id', 'DESC')
      .take(opts.limit);
    applyScope(qb);
    if (!opts.includeInternal) qb.andWhere('m.isInternal = false');
    if (opts.q) qb.andWhere('m.body ILIKE :q', { q: `%${opts.q}%` });
    if (opts.beforeId) {
      qb.andWhere(
        '(m.createdAt, m.id) < (SELECT c.created_at, c.id FROM chat_message c WHERE c.id = :beforeId)',
        { beforeId: opts.beforeId },
      );
    }
    return qb.getRawAndEntities();
  }
}
