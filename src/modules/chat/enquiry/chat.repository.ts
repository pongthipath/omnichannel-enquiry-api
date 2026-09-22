import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { Actor } from '../../../common/auth/actor';
import { ChatStatus } from '../../../common/constants/enums';
import { ChatAccessPolicy, ScopeFilter } from './chat-access.policy';
import { Chat } from './chat.entity';

export interface ListChatsParams {
  scope?: ScopeFilter;
  status?: ChatStatus[];
  q?: string;
  productId?: string;
  customerId?: string;
  tagId?: string;
  /** id of the last chat of the previous page */
  cursor?: string;
  limit: number;
}

/** All chat queries. Every read that returns chats to a user goes through ChatAccessPolicy. */
@Injectable()
export class ChatRepository {
  constructor(@InjectRepository(Chat) private readonly repo: Repository<Chat>) {}

  private r(manager?: EntityManager): Repository<Chat> {
    return manager ? manager.getRepository(Chat) : this.repo;
  }

  async nextReference(manager: EntityManager, now = new Date()): Promise<string> {
    const [{ n }] = await manager.query(`SELECT nextval('chat_reference_seq') AS n`);
    return `ENQ-${now.getFullYear()}-${String(n).padStart(6, '0')}`;
  }

  /** INSERT … ON CONFLICT (customer_id, client_request_id) DO NOTHING — returns null when it already existed. */
  async insertIgnoringDuplicate(
    manager: EntityManager,
    values: QueryDeepPartialEntity<Chat>,
  ): Promise<string | null> {
    const result = await manager
      .createQueryBuilder()
      .insert()
      .into(Chat)
      .values(values)
      .orIgnore()
      .returning(['id'])
      .execute();
    return (result.raw as { id: string }[])[0]?.id ?? null;
  }

  findByClientRequestId(customerId: string, clientRequestId: string, manager?: EntityManager) {
    return this.r(manager).findOne({ where: { customerId, clientRequestId } });
  }

  findById(id: string, manager?: EntityManager): Promise<Chat | null> {
    return this.r(manager).findOne({ where: { id } });
  }

  /** Row lock for status/assignment changes inside a transaction. */
  findByIdForUpdate(manager: EntityManager, id: string): Promise<Chat | null> {
    return manager
      .getRepository(Chat)
      .findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
  }

  async list(actor: Actor, p: ListChatsParams): Promise<Chat[]> {
    const qb = this.repo.createQueryBuilder('chat');
    ChatAccessPolicy.applyScope(qb, 'chat', actor, p.scope);
    if (p.status?.length) qb.andWhere('chat.status IN (:...status)', { status: p.status });
    if (p.productId) qb.andWhere('chat.productId = :productId', { productId: p.productId });
    if (p.customerId) qb.andWhere('chat.customerId = :customerId', { customerId: p.customerId });
    if (p.tagId) {
      qb.andWhere(
        'EXISTS (SELECT 1 FROM chat_tag ct WHERE ct.chat_id = chat.id AND ct.tag_id = :tagId)',
        { tagId: p.tagId },
      );
    }
    if (p.q) {
      // one search box for the chat list (design §16.10): reference, subject, customer, product and
      // message text — the sub-queries use the trigram indexes. Internal notes are never searched here.
      qb.andWhere(
        `(chat.reference ILIKE :q OR chat.subject ILIKE :q
          OR chat.customerId IN (SELECT c.id FROM customer c
               WHERE c.company_name ILIKE :q OR c.contact_name ILIKE :q OR c.phone ILIKE :q)
          OR chat.productId IN (SELECT p.id FROM product p
               WHERE lower(p.code || ' ' || p.name || ' ' || coalesce(p.brand, '') || ' ' || coalesce(p.category, '')) LIKE lower(:q))
          OR EXISTS (SELECT 1 FROM chat_message m
               WHERE m.chat_id = chat.id AND m.is_internal = false AND m.body ILIKE :q))`,
        { q: `%${p.q}%` },
      );
    }
    // keyset pagination: stable, no duplicates across pages
    if (p.cursor) {
      qb.andWhere(
        '(chat.lastMessageAt, chat.id) < (SELECT c.last_message_at, c.id FROM chat c WHERE c.id = :cursor)',
        { cursor: p.cursor },
      );
    }
    return qb
      .orderBy('chat.lastMessageAt', 'DESC')
      .addOrderBy('chat.id', 'DESC')
      .take(p.limit)
      .getMany();
  }

  save(manager: EntityManager, chat: Chat): Promise<Chat> {
    return manager.getRepository(Chat).save(chat);
  }
}
