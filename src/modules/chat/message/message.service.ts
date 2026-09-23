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
import { ChatEvent, chatRooms } from '../chat-events';
import { ChatAccessPolicy } from '../enquiry/chat-access.policy';
import { applyStatusChange } from '../enquiry/chat-lifecycle';
import { Chat } from '../enquiry/chat.entity';
import { ChatRepository } from '../enquiry/chat.repository';
import { SlaService } from '../sla/sla.service';
import { CustomerService } from '../../customer/customer.service';
import { AttachmentService } from '../attachment/attachment.service';
import { AttachmentKind } from '../attachment/chat-message-attachment.entity';
import { StaffService } from '../../staff/profile/staff.service';
import { ChatMessage } from './chat-message.entity';
import { ChatMessageRepository } from './chat-message.repository';
import {
  CustomerMessagePageDto,
  ListCustomerMessagesQuery,
  ListMessagesQuery,
  MessageDto,
  MessagePageDto,
  SendMessageDto,
} from './message.dto';

const PREVIEW_LENGTH = 140;

export interface InboundOptions {
  channel: Channel;
  externalMessageId?: string;
  files?: { url: string; mimeType: string; fileName: string }[];
}

@Injectable()
export class MessageService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly chats: ChatRepository,
    private readonly messages: ChatMessageRepository,
    private readonly sla: SlaService,
    private readonly realtime: RealtimePublisher,
    private readonly staff: StaffService,
    private readonly customers: CustomerService,
    private readonly attachments: AttachmentService,
  ) {}

  async list(actor: Actor, chatId: string, query: ListMessagesQuery): Promise<MessagePageDto> {
    const chat = await this.chats.findById(chatId);
    if (!chat || !ChatAccessPolicy.canView(actor, chat))
      throw new NotFoundException('chat.notFound');
    const limit = query.limit ?? 30;
    const rows = await this.messages.list(chatId, {
      includeInternal: isStaff(actor) && actor.can(Permission.INBOX_CHAT_INTERNAL_VIEW),
      beforeId: query.before,
      limit: limit + 1,
    });
    const page = rows.slice(0, limit);
    const [names, files] = await Promise.all([this.senderNames(page), this.attachments.findForMessages(page.map((m) => m.id))]);
    return {
      items: page.map((m) => MessageDto.from(m, (m.senderId && names.get(m.senderId)) || null, files.get(m.id) ?? [])),
      nextCursor: rows.length > limit ? page[page.length - 1].id : null,
    };
  }

  /**
   * Everything one customer wrote or was told, across their enquiries (design A9). `q` searches the
   * text (A10) and needs its own permission — an agent may read a thread without being able to
   * search every word of it.
   */
  async listForCustomer(
    actor: StaffActor,
    customerId: string,
    query: ListCustomerMessagesQuery,
  ): Promise<CustomerMessagePageDto> {
    const q = query.q?.trim();
    if (q && !actor.can(Permission.INBOX_CUSTOMER_CHAT_SEARCH_MESSAGES)) {
      throw new ForbiddenException('auth.forbidden');
    }
    const limit = query.limit ?? 30;
    const { entities, raw } = await this.messages.listForCustomer(
      customerId,
      {
        includeInternal: actor.can(Permission.INBOX_CHAT_INTERNAL_VIEW),
        q: q || undefined,
        beforeId: query.before,
        limit: limit + 1,
      },
      (qb) => ChatAccessPolicy.applyScope(qb as never, 'chat', actor),
    );
    const page = entities.slice(0, limit);
    const [names, files] = await Promise.all([
      this.senderNames(page),
      this.attachments.findForMessages(page.map((m) => m.id)),
    ]);
    return {
      items: page.map((m, i) => ({
        ...MessageDto.from(m, (m.senderId && names.get(m.senderId)) || null, files.get(m.id) ?? []),
        chatReference: String(raw[i]?.chat_reference ?? ''),
        chatSubject: String(raw[i]?.chat_subject ?? ''),
      })),
      nextCursor: entities.length > limit ? page[page.length - 1].id : null,
    };
  }

  /** senderId → display name for one page (staff name, or the customer's contact / company). */
  private async senderNames(rows: ChatMessage[]): Promise<Map<string, string>> {
    const ids = (type: SenderType) =>
      [...new Set(rows.filter((m) => m.senderType === type && m.senderId).map((m) => m.senderId!))];
    const [staff, customers] = await Promise.all([
      this.staff.findByIds(ids(SenderType.STAFF)),
      this.customers.findSummaries(ids(SenderType.CUSTOMER)),
    ]);
    return new Map([
      ...staff.map((s) => [s.id, s.name] as [string, string]),
      ...[...customers.values()].map((c) => [c.id, c.contactName ?? c.companyName] as [string, string]),
    ]);
  }

  /**
   * Idempotent send (clientMessageId). Side effects in the same transaction (design §6):
   * - customer reply: WAITING → IN_PROGRESS · RESOLVED/CLOSED → OPEN (reopen, owner kept, new SLA)
   * - owner's first reply: ASSIGNED → IN_PROGRESS · first staff reply sets first_response_at
   */
  async send(
    actor: Actor,
    chatId: string,
    dto: SendMessageDto,
    /** webhook path: the real channel, the channel's message id (dedupe) and its image URLs */
    inbound?: InboundOptions,
  ): Promise<{ message: MessageDto; created: boolean }> {
    if (isStaff(actor) && !actor.can(Permission.INBOX_CHAT_REPLY))
      throw new ForbiddenException('auth.forbidden');
    const isInternal = isStaff(actor) && Boolean(dto.isInternal);
    const attachmentIds = dto.attachmentIds ?? [];
    if (!dto.body.trim() && !attachmentIds.length && !(inbound?.files?.length)) throw new BadRequestException('message.empty');
    const files = await this.attachments.findByIdsForSend(attachmentIds);
    const channel = inbound?.channel ?? Channel.MOBILE_APP;
    const sourceFiles = inbound?.files ?? [];
    const hasImage = files.some((f) => f.kind === AttachmentKind.IMAGE) || sourceFiles.some((f) => f.mimeType.startsWith('image/'));

    const result = await this.dataSource.transaction(async (m) => {
      const chat = await this.chats.findByIdForUpdate(m, chatId);
      if (!chat || !ChatAccessPolicy.canView(actor, chat))
        throw new NotFoundException('chat.notFound');

      if (dto.clientMessageId) {
        const existing = await this.messages.findByClientMessageId(chatId, dto.clientMessageId, m);
        if (existing) return { chat, message: existing, created: false, statusChanged: false };
      }
      // a closed chat reopens when the customer writes; staff can't post into it
      if (isStaff(actor) && chat.status === S.CLOSED) throw new ConflictException('chat.closed');

      const now = new Date();
      const senderType = isStaff(actor) ? SenderType.STAFF : SenderType.CUSTOMER;
      const id = await this.messages.insertIgnoringDuplicate(m, {
        chatId,
        clientMessageId: dto.clientMessageId ?? null,
        channel,
        externalMessageId: inbound?.externalMessageId ?? null,
        senderType,
        senderId: actor.id,
        messageType: attachmentIds.length || sourceFiles.length ? (hasImage ? MessageType.IMAGE : MessageType.FILE) : MessageType.TEXT,
        body: dto.body,
        isInternal,
      });
      if (!id) {
        // lost the race on clientMessageId, or the channel already delivered this message id
        const winner = inbound?.externalMessageId
          ? await this.messages.findByExternalMessageId(channel, inbound.externalMessageId, m)
          : await this.messages.findByClientMessageId(chatId, dto.clientMessageId!, m);
        return { chat, message: winner!, created: false, statusChanged: false };
      }

      await this.attachments.attachToMessage(m, attachmentIds, id);
      // channel images: keep the channel URL now, the worker mirrors them into our bucket later
      for (const f of sourceFiles) {
        const created = await this.attachments.createFromUrl(m, f);
        await this.attachments.attachToMessage(m, [created.id], id);
      }

      const statusChanged = isInternal
        ? false
        : await this.applyAutomaticTransitions(m, chat, actor, now);
      if (!isInternal) {
        chat.lastMessageAt = now;
        chat.lastMessagePreview = (dto.body.trim() || (hasImage ? '[รูปภาพ]' : '[ไฟล์แนบ]')).slice(0, PREVIEW_LENGTH);
        chat.lastMessageSenderType = senderType;
        chat.lastMessageChannel = channel;
        if (senderType === SenderType.CUSTOMER) chat.unreadByStaffCount += 1;
        else chat.unreadByStaffCount = 0; // answering means the team has read it
      }
      const saved = await this.chats.save(m, chat);
      return {
        chat: saved,
        message: (await this.messages.findById(id, m))!,
        created: true,
        statusChanged,
      };
    });

    const names = await this.senderNames([result.message]);
    const sentFiles = await this.attachments.findForMessages([result.message.id]);
    const message = MessageDto.from(
      result.message,
      (result.message.senderId && names.get(result.message.senderId)) || null,
      sentFiles.get(result.message.id) ?? [],
    );
    if (result.created) {
      this.realtime.emit(
        ChatEvent.MESSAGE_CREATED,
        chatRooms(result.chat, { includeCustomer: !message.isInternal }),
        {
          entity: 'chat_message',
          id: message.id,
          action: 'created',
          data: message,
        },
      );
      this.realtime.emit(
        ChatEvent.CHAT_UPDATED,
        chatRooms(result.chat, { includeCustomer: true }),
        {
          entity: 'chat',
          id: result.chat.id,
          action: 'updated',
          version: result.chat.version,
        },
      );
    }
    return { message, created: result.created };
  }

  private async applyAutomaticTransitions(
    m: EntityManager,
    chat: Chat,
    actor: Actor,
    now: Date,
  ): Promise<boolean> {
    let to: S | null = null;
    let kind = ChatEventKind.STATUS_CHANGED;

    if (!isStaff(actor)) {
      if (chat.status === S.WAITING_FOR_CUSTOMER) to = S.IN_PROGRESS;
      if (chat.status === S.RESOLVED || chat.status === S.CLOSED) {
        to = S.OPEN;
        kind = ChatEventKind.REOPENED;
      }
    } else {
      if (!chat.firstResponseAt) chat.firstResponseAt = now;
      if (chat.status === S.ASSIGNED && chat.assignedStaffId === actor.id) to = S.IN_PROGRESS;
    }
    if (!to) return false;

    const from = chat.status;
    const reopenSla =
      to === S.OPEN ? await this.sla.targetFor(chat.enquiryType, chat.priority, now) : undefined;
    applyStatusChange(chat, to, now, reopenSla);
    await this.messages.insertIgnoringDuplicate(m, {
      chatId: chat.id,
      channel: Channel.MOBILE_APP,
      senderType: SenderType.SYSTEM,
      senderId: null,
      messageType: MessageType.EVENT,
      eventData: {
        kind,
        from,
        to,
        reopenCount: chat.reopenCount,
        by: isStaff(actor) ? 'OWNER_REPLY' : 'CUSTOMER_MESSAGE',
      },
    });
    return true;
  }
}
