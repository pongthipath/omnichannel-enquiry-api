import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { Actor, isStaff, StaffActor } from '../../../common/auth/actor';
import {
  Channel,
  ChatEventKind,
  ChatStatus as S,
  MessageType,
  SenderType,
} from '../../../common/constants/enums';
import { Permission } from '../../../common/permissions/permission.enum';
import { RealtimePublisher } from '../../../common/realtime/realtime.publisher';
import { CustomerService } from '../../customer/customer.service';
import { DepartmentService } from '../../staff/department/department.service';
import { StaffService } from '../../staff/profile/staff.service';
import { ChatEvent, chatRooms } from '../chat-events';
import { ChatMessageRepository } from '../message/chat-message.repository';
import { SlaService } from '../sla/sla.service';
import { TagSummaryDto } from '../tag/tag.dto';
import { TagRepository } from '../tag/tag.repository';
import { TagService } from '../tag/tag.service';
import { ChatAccessPolicy } from './chat-access.policy';
import { applyStatusChange } from './chat-lifecycle';
import { Chat } from './chat.entity';
import { ChatRepository } from './chat.repository';
import { assertCanChangeStatus } from './enquiry-status.policy';
import {
  CreateEnquiryDto,
  CustomerSummaryDto,
  EnquiryDto,
  EnquiryPageDto,
  ListEnquiriesQuery,
  UpdateEnquiryDto,
} from './enquiry.dto';

const PREVIEW_LENGTH = 140;

type ChatChange = { kind: ChatEventKind; data: Record<string, unknown>; internal?: boolean };

@Injectable()
export class EnquiryService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly chats: ChatRepository,
    private readonly messages: ChatMessageRepository,
    private readonly sla: SlaService,
    private readonly departments: DepartmentService,
    private readonly staff: StaffService,
    private readonly customers: CustomerService,
    private readonly realtime: RealtimePublisher,
    private readonly tags: TagRepository,
    private readonly tagService: TagService,
  ) {}

  /**
   * Idempotent create (design §7.3): the device-generated clientRequestId + UNIQUE(customer_id,
   * client_request_id) guarantee a retried request never creates a second enquiry.
   */
  async create(
    actor: Actor,
    dto: CreateEnquiryDto,
  ): Promise<{ enquiry: EnquiryDto; created: boolean }> {
    const customerId = this.resolveCustomerId(actor, dto);
    const now = new Date();

    const { chat, created } = await this.dataSource.transaction(async (m) => {
      if (dto.clientRequestId) {
        const existing = await this.chats.findByClientRequestId(customerId, dto.clientRequestId, m);
        if (existing) return { chat: existing, created: false };
      }
      const department = await this.departments.getDefault();
      const target = await this.sla.targetFor(dto.enquiryType, dto.priority, now);
      const channel = dto.channel ?? Channel.MOBILE_APP;

      const id = await this.chats.insertIgnoringDuplicate(m, {
        reference: await this.chats.nextReference(m, now),
        customerId,
        clientRequestId: dto.clientRequestId ?? null,
        departmentId: department.id,
        productId: dto.productId ?? null,
        originChannel: channel,
        enquiryType: dto.enquiryType,
        enquirySubType: dto.enquirySubType ?? null,
        subject: dto.subject,
        description: dto.description,
        priority: dto.priority,
        status: S.OPEN,
        ...target,
        lastMessageAt: now,
        lastMessagePreview: dto.description.slice(0, PREVIEW_LENGTH),
        lastMessageSenderType: SenderType.CUSTOMER,
        lastMessageChannel: channel,
        unreadByStaffCount: 1,
      });
      // a concurrent request with the same key won the race → return its row
      if (!id) {
        const winner = await this.chats.findByClientRequestId(customerId, dto.clientRequestId!, m);
        return { chat: winner!, created: false };
      }

      // the description is the first message of the thread
      await this.messages.insertIgnoringDuplicate(m, {
        chatId: id,
        clientMessageId: dto.clientRequestId ?? null,
        channel,
        senderType: SenderType.CUSTOMER,
        senderId: customerId,
        messageType: MessageType.TEXT,
        body: dto.description,
      });
      return { chat: (await this.chats.findById(id, m))!, created: true };
    });

    const enquiry = await this.toDto(actor, chat);
    if (created) {
      await this.customers.touchContact(customerId);
      this.realtime.emit(ChatEvent.CHAT_CREATED, chatRooms(chat, { includeCustomer: true }), {
        entity: 'chat',
        id: chat.id,
        action: 'created',
        version: chat.version,
        data: enquiry,
      });
    }
    return { enquiry, created };
  }

  async list(actor: Actor, query: ListEnquiriesQuery): Promise<EnquiryPageDto> {
    const limit = query.limit ?? 30;
    const rows = await this.chats.list(actor, { ...query, limit: limit + 1 });
    const page = rows.slice(0, limit);
    return {
      items: await this.toDtos(actor, page),
      nextCursor: rows.length > limit ? page[page.length - 1].id : null,
    };
  }

  /** Edit the enquiry's details (Context Panel). Type/priority changes re-snapshot the SLA target. */
  async update(actor: Actor, id: string, dto: UpdateEnquiryDto): Promise<EnquiryDto> {
    const staffActor = this.requireStaff(actor);
    if (!staffActor.can(Permission.INBOX_ENQUIRY_EDIT)) throw new ForbiddenException('auth.forbidden');
    const slaStart = (c: Chat) => c.lastReopenedAt ?? c.createdAt;

    return this.mutate(staffActor, id, async (chat) => {
      const changes: Record<string, unknown> = {};
      const set = <K extends keyof Chat>(key: K, value: Chat[K]) => {
        if (chat[key] === value) return;
        changes[key] = { from: chat[key], to: value };
        chat[key] = value;
      };
      if (dto.subject !== undefined) set('subject', dto.subject.trim());
      if (dto.enquiryType !== undefined) set('enquiryType', dto.enquiryType);
      if (dto.enquirySubType !== undefined) set('enquirySubType', dto.enquirySubType || null);
      if (dto.priority !== undefined) set('priority', dto.priority);
      if (dto.productId !== undefined) set('productId', dto.productId);
      if (!Object.keys(changes).length) return null;

      if (('enquiryType' in changes || 'priority' in changes) && ![S.RESOLVED, S.CLOSED].includes(chat.status)) {
        const target = await this.sla.targetFor(chat.enquiryType, chat.priority, slaStart(chat));
        chat.slaMinutes = target.slaMinutes;
        chat.slaDueAt = new Date(target.slaDueAt.getTime() + chat.slaPausedSeconds * 1000);
        chat.isSlaBreached = chat.slaDueAt.getTime() < Date.now();
      }
      return { kind: ChatEventKind.UPDATED, data: { changes }, internal: true };
    });
  }

  /** Replace the enquiry's tags (INBOX_TAG_APPLY). */
  async setTags(actor: Actor, id: string, tagIds: string[]): Promise<EnquiryDto> {
    const staffActor = this.requireStaff(actor);
    if (!staffActor.can(Permission.INBOX_TAG_APPLY)) throw new ForbiddenException('auth.forbidden');
    await this.tagService.assertApplicableToEnquiry(tagIds);
    const unique = [...new Set(tagIds)];

    // recorded in the history as an internal event: which tags were added / removed (by name)
    return this.mutate(staffActor, id, async (chat, m) => {
      const before = (await this.tags.findForChats([chat.id])).get(chat.id) ?? [];
      const after = await this.tags.findByIds(unique);
      const added = after.filter((t) => !before.some((b) => b.id === t.id)).map((t) => t.name);
      const removed = before.filter((b) => !unique.includes(b.id)).map((t) => t.name);
      if (!added.length && !removed.length) return null;
      await this.tags.replaceForChat(m, chat.id, unique);
      return { kind: ChatEventKind.TAGS_CHANGED, data: { added, removed }, internal: true };
    });
  }

  async get(actor: Actor, id: string): Promise<EnquiryDto> {
    return this.toDto(actor, await this.getVisible(actor, id));
  }

  /** 404 (not 403) when out of scope — never reveal that the chat exists (design §16.4). */
  async getVisible(actor: Actor, id: string, manager?: EntityManager): Promise<Chat> {
    const chat = await this.chats.findById(id, manager);
    if (!chat || !ChatAccessPolicy.canView(actor, chat))
      throw new NotFoundException('chat.notFound');
    return chat;
  }

  /** OPEN → ASSIGNED, or change owner (→ ASSIGNED). Design §6.1 / §6.3. */
  async assign(actor: Actor, id: string, staffId: string): Promise<EnquiryDto> {
    const staffActor = this.requireStaff(actor);
    const self = staffId === staffActor.id;
    const allowed = self
      ? staffActor.can(Permission.INBOX_ASSIGN_SELF) ||
        staffActor.can(Permission.INBOX_ASSIGN_OTHERS)
      : staffActor.can(Permission.INBOX_ASSIGN_OTHERS);
    if (!allowed) throw new ForbiddenException('auth.forbidden');

    const target = await this.staff.findById(staffId);
    if (!target?.isActive) throw new BadRequestException('staff.notFound');

    return this.mutate(staffActor, id, (chat) => {
      if (![S.OPEN, S.ASSIGNED, S.IN_PROGRESS, S.WAITING_FOR_CUSTOMER].includes(chat.status)) {
        throw new ConflictException('chat.invalidTransition');
      }
      if (chat.assignedStaffId === staffId && chat.status !== S.OPEN) return null; // nothing to do
      const kind = chat.assignedStaffId ? ChatEventKind.REASSIGNED : ChatEventKind.ASSIGNED;
      const from = chat.status;
      chat.assignedStaffId = staffId;
      applyStatusChange(chat, S.ASSIGNED, new Date());
      return { kind, data: { from, to: S.ASSIGNED, staffId, staffName: target.name } };
    });
  }

  async changeStatus(
    actor: Actor,
    id: string,
    to: S,
    expectedVersion?: number,
  ): Promise<EnquiryDto> {
    return this.mutate(actor, id, (chat) => {
      if (expectedVersion !== undefined && expectedVersion !== chat.version) {
        throw new ConflictException('chat.statusChanged');
      }
      assertCanChangeStatus(chat, to, actor);
      const from = chat.status;
      applyStatusChange(chat, to, new Date());
      return { kind: ChatEventKind.STATUS_CHANGED, data: { from, to } };
    });
  }

  /** Move to another department's queue: back to OPEN, owner cleared (design §6.3). */
  async escalate(
    actor: Actor,
    id: string,
    departmentId: string,
    reason: string,
  ): Promise<EnquiryDto> {
    const staffActor = this.requireStaff(actor);
    if (!staffActor.can(Permission.INBOX_STATUS_ESCALATE))
      throw new ForbiddenException('auth.forbidden');
    const department = await this.departments.findActiveById(departmentId);
    if (!department) throw new BadRequestException('department.notFound');

    return this.mutate(staffActor, id, (chat) => {
      const isOwner = chat.assignedStaffId === staffActor.id;
      if (!isOwner && !staffActor.can(Permission.INBOX_STATUS_CHANGE_ANY)) {
        throw new ForbiddenException('chat.notResponsible');
      }
      if ([S.RESOLVED, S.CLOSED].includes(chat.status))
        throw new ConflictException('chat.invalidTransition');
      if (chat.departmentId === departmentId) throw new BadRequestException('chat.sameDepartment');
      const fromDepartmentId = chat.departmentId;
      chat.departmentId = departmentId;
      chat.assignedStaffId = null;
      chat.escalatedAt = new Date();
      applyStatusChange(chat, S.OPEN, new Date());
      return {
        kind: ChatEventKind.ESCALATED,
        data: {
          fromDepartmentId,
          toDepartmentId: departmentId,
          toDepartmentName: department.nameTh,
          reason,
        },
        internal: true,
      };
    });
  }

  /**
   * Shared shape of every chat change: lock row → check access → apply → write EVENT message
   * in the same transaction → emit after commit to old + new audience.
   */
  private async mutate(
    actor: Actor,
    id: string,
    change: (chat: Chat, m: EntityManager) => ChatChange | null | Promise<ChatChange | null>,
  ): Promise<EnquiryDto> {
    let before: Pick<Chat, 'customerId' | 'assignedStaffId' | 'departmentId'> | null = null;
    const chat = await this.dataSource.transaction(async (m) => {
      const locked = await this.chats.findByIdForUpdate(m, id);
      if (!locked || !ChatAccessPolicy.canView(actor, locked))
        throw new NotFoundException('chat.notFound');
      before = {
        customerId: locked.customerId,
        assignedStaffId: locked.assignedStaffId,
        departmentId: locked.departmentId,
      };
      const event = await change(locked, m);
      if (!event) return locked;
      const saved = await this.chats.save(m, locked);
      await this.messages.insertIgnoringDuplicate(m, {
        chatId: saved.id,
        channel: Channel.MOBILE_APP,
        senderType: isStaff(actor) ? SenderType.STAFF : SenderType.CUSTOMER,
        senderId: actor.id,
        messageType: MessageType.EVENT,
        eventData: { kind: event.kind, ...event.data },
        isInternal: event.internal ?? false,
      });
      return saved;
    });

    const dto = await this.toDto(actor, chat);
    // people who lost visibility (e.g. old department after escalation) also get the update to drop it
    const audience = [
      ...chatRooms(chat, { includeCustomer: true }),
      ...(before ? chatRooms(before, { includeCustomer: false }) : []),
    ];
    this.realtime.emit(ChatEvent.CHAT_UPDATED, audience, {
      entity: 'chat',
      id: chat.id,
      action: 'updated',
      version: chat.version,
      data: dto,
    });
    return dto;
  }

  private async toDto(actor: Actor, chat: Chat): Promise<EnquiryDto> {
    return (await this.toDtos(actor, [chat]))[0];
  }

  /** One lookup per kind of name for the whole page — never one query per row. */
  async toDtos(actor: Actor, chats: Chat[]): Promise<EnquiryDto[]> {
    const ids = <K extends keyof Chat>(key: K) =>
      [...new Set(chats.map((c) => c[key]).filter(Boolean))] as string[];
    const [customers, tags, staff, departments] = await Promise.all([
      this.customers.findSummaries(ids('customerId')),
      this.tags.findForChats(chats.map((c) => c.id)),
      this.staff.findByIds(ids('assignedStaffId')),
      this.departments.findByIds(ids('departmentId')),
    ]);
    const staffName = new Map(staff.map((s) => [s.id, s.name]));
    const deptName = new Map(departments.map((d) => [d.id, d.nameTh]));
    return chats.map((c) =>
      EnquiryDto.from(c, ChatAccessPolicy.visibility(actor, c), {
        customer: this.customerSummary(customers.get(c.customerId)),
        tags: (tags.get(c.id) ?? []).map(TagSummaryDto.from),
        assignedStaffName: c.assignedStaffId ? (staffName.get(c.assignedStaffId) ?? null) : null,
        departmentName: deptName.get(c.departmentId) ?? null,
      }),
    );
  }

  private customerSummary(c?: {
    id: string;
    companyName: string;
    contactName: string | null;
  }): CustomerSummaryDto | null {
    return c ? { id: c.id, companyName: c.companyName, contactName: c.contactName } : null;
  }

  private resolveCustomerId(actor: Actor, dto: CreateEnquiryDto): string {
    if (!isStaff(actor)) return actor.id;
    if (!actor.can(Permission.INBOX_ENQUIRY_CREATE)) throw new ForbiddenException('auth.forbidden');
    if (!dto.customerId) throw new BadRequestException('chat.customerRequired');
    return dto.customerId;
  }

  private requireStaff(actor: Actor): StaffActor {
    if (!isStaff(actor)) throw new ForbiddenException('auth.staffOnly');
    return actor;
  }
}
