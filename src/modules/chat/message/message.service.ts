import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { Actor, isStaff } from '../../../common/auth/actor';
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
import { ChatMessageRepository } from './chat-message.repository';
import { ListMessagesQuery, MessageDto, MessagePageDto, SendMessageDto } from './message.dto';

const PREVIEW_LENGTH = 140;

@Injectable()
export class MessageService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly chats: ChatRepository,
    private readonly messages: ChatMessageRepository,
    private readonly sla: SlaService,
    private readonly realtime: RealtimePublisher,
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
    return {
      items: page.map(MessageDto.from),
      nextCursor: rows.length > limit ? page[page.length - 1].id : null,
    };
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
  ): Promise<{ message: MessageDto; created: boolean }> {
    if (isStaff(actor) && !actor.can(Permission.INBOX_CHAT_REPLY))
      throw new ForbiddenException('auth.forbidden');
    const isInternal = isStaff(actor) && Boolean(dto.isInternal);

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
        channel: Channel.MOBILE_APP,
        senderType,
        senderId: actor.id,
        messageType: MessageType.TEXT,
        body: dto.body,
        isInternal,
      });
      if (!id) {
        const winner = await this.messages.findByClientMessageId(chatId, dto.clientMessageId!, m);
        return { chat, message: winner!, created: false, statusChanged: false };
      }

      const statusChanged = isInternal
        ? false
        : await this.applyAutomaticTransitions(m, chat, actor, now);
      if (!isInternal) {
        chat.lastMessageAt = now;
        chat.lastMessagePreview = dto.body.slice(0, PREVIEW_LENGTH);
        chat.lastMessageSenderType = senderType;
        chat.lastMessageChannel = Channel.MOBILE_APP;
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

    const message = MessageDto.from(result.message);
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
