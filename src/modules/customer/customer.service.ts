import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { StaffActor } from '../../common/auth/actor';
import { Channel } from '../../common/constants/enums';
import { Permission } from '../../common/permissions/permission.enum';
import { RealtimePublisher, rooms } from '../../common/realtime/realtime.publisher';
import {
  CustomerListItemDto,
  CustomerPageDto,
  CustomerProfileDto,
  ListCustomersQuery,
  UpdateCustomerDto,
} from './customer.dto';
import { CustomerOrderDto } from './order/customer-order.dto';
import { Customer } from './profile/customer.entity';
import { CustomerRepository } from './profile/customer.repository';

const CONTACT_FIELDS = ['companyName', 'contactName', 'phone', 'email'] as const;

/** Facade of the customer module — other modules use this, never the repository. */
@Injectable()
export class CustomerService {
  constructor(
    private readonly customers: CustomerRepository,
    private readonly realtime: RealtimePublisher,
  ) {}

  findForLogin(email: string): Promise<Customer | null> {
    return this.customers.findForLogin(email);
  }

  async touchLogin(id: string): Promise<void> {
    await this.customers.touch(id, { lastLoginAt: new Date() });
  }

  async touchContact(id: string): Promise<void> {
    await this.customers.touch(id, { lastContactAt: new Date() });
  }

  async getById(id: string): Promise<Customer> {
    const customer = await this.customers.findById(id);
    if (!customer) throw new NotFoundException('customer.notFound');
    return customer;
  }

  /** Staff also get linked channels and the internal note; the customer sees their own basics. */
  async getProfile(id: string, forStaff: boolean): Promise<CustomerProfileDto> {
    const customer = await this.getById(id);
    const channels = forStaff ? ((await this.customers.channelsFor([id])).get(id) ?? []) : [];
    return CustomerProfileDto.from(customer, channels, forStaff);
  }

  async list(query: ListCustomersQuery): Promise<CustomerPageDto> {
    const { rows, total } = await this.customers.list({
      q: query.q?.trim() || undefined,
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
    });
    const channels = await this.customers.channelsFor(rows.map((r) => r.customer.id));
    return {
      total,
      items: rows.map(
        ({ customer, openEnquiries }): CustomerListItemDto => ({
          ...CustomerProfileDto.from(customer, channels.get(customer.id) ?? [], true),
          openEnquiries,
        }),
      ),
    };
  }

  /** Each field group needs its own permission (Customer Panel sections, design §16.13). */
  async update(actor: StaffActor, id: string, dto: UpdateCustomerDto): Promise<CustomerProfileDto> {
    const customer = await this.getById(id);
    if (dto.version !== undefined && dto.version !== customer.version) {
      throw new ConflictException('customer.changed');
    }
    const need = (p: Permission) => {
      if (!actor.can(p)) throw new ForbiddenException('auth.forbidden');
    };
    if (CONTACT_FIELDS.some((f) => dto[f] !== undefined)) need(Permission.CUSTOMER_PANEL_CONTACT_EDIT);
    if (dto.internalNote !== undefined) need(Permission.CUSTOMER_PANEL_NOTE_EDIT);
    if (dto.salespersonStaffId !== undefined) need(Permission.CUSTOMER_PANEL_SALESPERSON_ASSIGN);

    if (dto.companyName !== undefined) customer.companyName = dto.companyName.trim();
    if (dto.contactName !== undefined) customer.contactName = dto.contactName.trim() || null;
    if (dto.phone !== undefined) customer.phone = dto.phone.trim() || null;
    if (dto.email !== undefined) customer.email = dto.email.trim().toLowerCase() || null;
    if (dto.internalNote !== undefined) customer.internalNote = dto.internalNote.trim() || null;
    if (dto.salespersonStaffId !== undefined) {
      customer.salespersonStaffId = dto.salespersonStaffId;
      customer.salesperson = null; // reloaded by getProfile with the new relation
    }
    try {
      await this.customers.save(customer);
    } catch (e) {
      if ((e as { code?: string }).code === '23505') {
        throw new ConflictException('customer.duplicateEmail');
      }
      throw e;
    }
    const profile = await this.getProfile(id, true);
    this.realtime.emit('customer.updated', [rooms.allStaff], {
      entity: 'customer',
      id,
      action: 'updated',
      version: profile.version,
      data: profile,
    });
    return profile;
  }

  /**
   * Webhook path: who wrote from this channel. Unknown sender → an unverified (placeholder) customer
   * that staff can later merge into the real one (design §8.5).
   */
  async resolveFromChannel(channel: Channel, externalId: string, displayName?: string): Promise<Customer> {
    const known = await this.customers.findByChannel(channel, externalId);
    if (known) return known;
    return this.customers.createPlaceholderWithChannel({ channel, externalId, displayName });
  }

  /** Orders shown in the Customer 360 panel (design §12). */
  async orders(customerId: string): Promise<CustomerOrderDto[]> {
    await this.getById(customerId);
    return (await this.customers.ordersFor(customerId)).map(CustomerOrderDto.from);
  }

  /**
   * Fold an unverified customer (created from a channel) into the real one. Everything they wrote
   * moves across, so the team keeps one history per customer.
   */
  async merge(placeholderId: string, targetId: string): Promise<CustomerProfileDto> {
    if (placeholderId === targetId) throw new ConflictException('customer.mergeSame');
    const [placeholder, target] = await Promise.all([this.getById(placeholderId), this.getById(targetId)]);
    if (!placeholder.isPlaceholder) throw new ConflictException('customer.notPlaceholder');
    if (target.isPlaceholder) throw new ConflictException('customer.targetIsPlaceholder');

    await this.customers.mergeInto(placeholderId, targetId);
    const profile = await this.getProfile(targetId, true);
    this.realtime.emit('customer.updated', [rooms.allStaff], {
      entity: 'customer',
      id: targetId,
      action: 'updated',
      data: profile,
    });
    return profile;
  }

  /** id → summary map for list screens (one query per page). */
  async findSummaries(ids: string[]): Promise<Map<string, Customer>> {
    const rows = await this.customers.findByIds([...new Set(ids)]);
    return new Map(rows.map((c) => [c.id, c]));
  }

  searchIds(q: string): Promise<string[]> {
    return this.customers.searchIds(q);
  }
}
