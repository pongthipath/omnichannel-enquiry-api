import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Channel } from '../../../common/constants/enums';
import { CustomerOrder } from '../order/customer-order.entity';
import { CustomerChannel } from './customer-channel.entity';
import { Customer } from './customer.entity';

const SEARCH_WHERE = `(customer.companyName ILIKE :like OR customer.contactName ILIKE :like
  OR customer.phone ILIKE :like OR customer.email ILIKE :like OR customer.code ILIKE :like)`;

@Injectable()
export class CustomerRepository {
  constructor(
    @InjectRepository(Customer) private readonly repo: Repository<Customer>,
    @InjectRepository(CustomerChannel) private readonly channels: Repository<CustomerChannel>,
    @InjectRepository(CustomerOrder) private readonly orders: Repository<CustomerOrder>,
  ) {}

  findForLogin(email: string): Promise<Customer | null> {
    return this.repo
      .createQueryBuilder('customer')
      .addSelect('customer.passwordHash')
      .where('lower(customer.email) = lower(:email)', { email })
      .getOne();
  }

  findById(id: string): Promise<Customer | null> {
    return this.repo.findOne({ where: { id }, relations: { salesperson: true } });
  }

  findByIds(ids: string[]): Promise<Customer[]> {
    return ids.length ? this.repo.find({ where: { id: In(ids) } }) : Promise.resolve([]);
  }

  /** Trigram search over name/contact/phone/email/code (design §16.10). */
  async searchIds(q: string, limit = 500): Promise<string[]> {
    const rows = await this.repo
      .createQueryBuilder('customer')
      .select('customer.id', 'id')
      .where(SEARCH_WHERE, { like: `%${q}%` })
      .limit(limit)
      .getRawMany<{ id: string }>();
    return rows.map((r) => r.id);
  }

  /**
   * Customers page: most recent contact first, with the number of enquiries still open
   * (one sub-select on chat — no chats are loaded).
   */
  async list(p: { q?: string; limit: number; offset: number }): Promise<{
    rows: { customer: Customer; openEnquiries: number }[];
    total: number;
  }> {
    const qb = this.repo
      .createQueryBuilder('customer')
      .leftJoinAndSelect('customer.salesperson', 'salesperson')
      .addSelect(
        `(SELECT COUNT(*)::int FROM chat WHERE chat.customer_id = customer.id
           AND chat.status NOT IN ('RESOLVED', 'CLOSED'))`,
        'open_enquiries',
      );
    if (p.q) qb.where(SEARCH_WHERE, { like: `%${p.q}%` });
    const total = await qb.getCount();
    const { entities, raw } = await qb
      .orderBy('customer.lastContactAt', 'DESC', 'NULLS LAST')
      .addOrderBy('customer.companyName', 'ASC')
      .offset(p.offset)
      .limit(p.limit)
      .getRawAndEntities<{ customer_id: string; open_enquiries: number }>();
    const open = new Map(raw.map((r) => [r.customer_id, r.open_enquiries]));
    return {
      rows: entities.map((customer) => ({ customer, openEnquiries: open.get(customer.id) ?? 0 })),
      total,
    };
  }

  /** The customer behind a channel identity (LINE userId, Facebook PSID…), if we know them. */
  async findByChannel(channel: Channel, externalId: string): Promise<Customer | null> {
    const link = await this.channels.findOne({ where: { channel, externalId }, relations: { customer: true } });
    return link?.customer ?? null;
  }

  /** First contact from a channel: an unverified customer + the channel link, in one transaction. */
  async createPlaceholderWithChannel(input: {
    channel: Channel;
    externalId: string;
    displayName?: string;
  }): Promise<Customer> {
    return this.repo.manager.transaction(async (m) => {
      const code = `CUS-TMP-${Date.now().toString(36).toUpperCase()}`;
      const customer = await m.getRepository(Customer).save(
        m.getRepository(Customer).create({
          code,
          companyName: input.displayName?.slice(0, 200) || `${input.channel} ${input.externalId.slice(-6)}`,
          contactName: input.displayName?.slice(0, 120) ?? null,
          isPlaceholder: true,
          lastContactAt: new Date(),
        }),
      );
      await m.getRepository(CustomerChannel).insert({
        customerId: customer.id,
        channel: input.channel,
        externalId: input.externalId,
        displayName: input.displayName?.slice(0, 200) ?? null,
        lastSeenAt: new Date(),
      });
      return customer;
    });
  }

  async channelsFor(customerIds: string[]): Promise<Map<string, CustomerChannel[]>> {
    const map = new Map<string, CustomerChannel[]>();
    if (!customerIds.length) return map;
    const rows = await this.channels.find({
      where: { customerId: In(customerIds) },
      order: { createdAt: 'ASC' },
    });
    for (const r of rows) map.set(r.customerId, [...(map.get(r.customerId) ?? []), r]);
    return map;
  }

  ordersFor(customerId: string, limit = 20): Promise<CustomerOrder[]> {
    return this.orders.find({ where: { customerId }, order: { orderedAt: 'DESC' }, take: limit });
  }

  /**
   * Merge an unverified customer (created by a webhook) into the real one: their channels, chats and
   * orders move over, then the placeholder row is deleted — all in one transaction (design §8.5).
   */
  async mergeInto(placeholderId: string, targetId: string): Promise<void> {
    await this.repo.manager.transaction(async (m) => {
      await m.query('UPDATE customer_channel SET customer_id = $1 WHERE customer_id = $2', [targetId, placeholderId]);
      await m.query('UPDATE chat SET customer_id = $1 WHERE customer_id = $2', [targetId, placeholderId]);
      await m.query('UPDATE customer_order SET customer_id = $1 WHERE customer_id = $2', [targetId, placeholderId]);
      await m.query("UPDATE chat_message SET sender_id = $1 WHERE sender_id = $2 AND sender_type = 'CUSTOMER'", [targetId, placeholderId]);
      await m.getRepository(Customer).delete(placeholderId);
    });
  }

  save(customer: Customer): Promise<Customer> {
    return this.repo.save(customer);
  }

  async touch(
    id: string,
    fields: Partial<Pick<Customer, 'lastLoginAt' | 'lastContactAt'>>,
  ): Promise<void> {
    await this.repo.update(id, fields);
  }
}
