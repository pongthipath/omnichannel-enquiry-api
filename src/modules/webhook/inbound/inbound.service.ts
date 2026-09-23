import { Injectable, Logger } from '@nestjs/common';
import { CustomerActor } from '../../../common/auth/actor';
import { Channel, EnquiryType, Priority, UserType } from '../../../common/constants/enums';
import { ChatRepository } from '../../chat/enquiry/chat.repository';
import { EnquiryService } from '../../chat/enquiry/enquiry.service';
import { MessageService } from '../../chat/message/message.service';
import { CustomerService } from '../../customer/customer.service';
import { InboundMessage, InboundResultDto } from './inbound.dto';

const SUBJECT_LENGTH = 80;

/** Only the fields we read from each provider's payload — everything else is ignored. */
interface LineEvent {
  type?: string;
  source?: { userId?: string };
  message?: { id?: string; type?: string; text?: string; contentUrl?: string };
}
interface FacebookMessaging {
  sender?: { id?: string };
  message?: {
    mid?: string;
    text?: string;
    attachments?: { type?: string; payload?: { url?: string } }[];
  };
}

/**
 * One message from any channel → the right chat (design §8).
 * Same person, still-open enquiry → it joins that thread; otherwise a new enquiry is created, so the
 * team never loses context. Delivering twice is safe: the channel's message id is unique in the DB.
 */
@Injectable()
export class InboundService {
  private readonly logger = new Logger(InboundService.name);

  constructor(
    private readonly customers: CustomerService,
    private readonly chats: ChatRepository,
    private readonly enquiries: EnquiryService,
    private readonly messages: MessageService,
  ) {}

  async handle(messages: InboundMessage[]): Promise<InboundResultDto> {
    const result: InboundResultDto = { accepted: 0, duplicates: 0, chatIds: [] };
    for (const inbound of messages) {
      try {
        const chatId = await this.handleOne(inbound, result);
        if (chatId && !result.chatIds.includes(chatId)) result.chatIds.push(chatId);
      } catch (e) {
        // one bad message must not drop the rest of the delivery
        this.logger.error(`inbound ${inbound.channel} failed: ${(e as Error).message}`);
      }
    }
    return result;
  }

  private async handleOne(inbound: InboundMessage, result: InboundResultDto): Promise<string | null> {
    const customer = await this.customers.resolveFromChannel(
      inbound.channel,
      inbound.externalUserId,
      inbound.displayName,
    );
    const actor: CustomerActor = { type: UserType.CUSTOMER, id: customer.id };
    const body = inbound.text?.trim() ?? '';
    const files = inbound.imageUrl
      ? [{ url: inbound.imageUrl, mimeType: 'image/jpeg', fileName: 'image.jpg' }]
      : [];

    const open = await this.chats.findLatestOpenForCustomer(customer.id);
    if (open) {
      const { created } = await this.messages.send(
        actor,
        open.id,
        { body },
        { channel: inbound.channel, externalMessageId: inbound.externalMessageId, files },
      );
      if (created) result.accepted++;
      else result.duplicates++;
      return open.id;
    }

    const { enquiry, created } = await this.enquiries.create(actor, {
      enquiryType: EnquiryType.GENERAL,
      subject: (body || `ข้อความจาก ${inbound.channel}`).slice(0, SUBJECT_LENGTH),
      description: body || '[รูปภาพ]',
      priority: Priority.NORMAL,
      channel: inbound.channel,
      clientRequestId: undefined,
    });
    if (created) result.accepted++;
    else result.duplicates++;
    // the first message is the description; an image arrives as its own message on the new thread
    if (files.length) {
      await this.messages.send(
        actor,
        enquiry.id,
        { body: '' },
        { channel: inbound.channel, externalMessageId: inbound.externalMessageId, files },
      );
    }
    return enquiry.id;
  }

  /** LINE webhook body → normalised messages (only text and image events are handled). */
  static fromLine(payload: unknown): InboundMessage[] {
    const events = (payload as { events?: LineEvent[] })?.events ?? [];
    return events
      .filter((e) => e.type === 'message' && e.source?.userId)
      .map((e) => ({
        channel: Channel.LINE,
        externalUserId: String(e.source!.userId),
        externalMessageId: e.message?.id ? `line:${e.message.id}` : undefined,
        text: e.message?.type === 'text' ? (e.message.text ?? '') : undefined,
        // a real integration downloads via the Messaging API; the simulator sends a plain link
        imageUrl: e.message?.type === 'image' ? e.message.contentUrl : undefined,
      }));
  }

  /** Facebook Messenger webhook body → normalised messages. */
  static fromFacebook(payload: unknown): InboundMessage[] {
    const entries = (payload as { entry?: { messaging?: FacebookMessaging[] }[] })?.entry ?? [];
    return entries.flatMap((entry) =>
      (entry.messaging ?? [])
        .filter((m) => m.sender?.id && m.message)
        .map((m) => ({
          channel: Channel.FACEBOOK,
          externalUserId: String(m.sender!.id),
          externalMessageId: m.message!.mid ? `fb:${m.message!.mid}` : undefined,
          text: m.message!.text,
          imageUrl: m.message!.attachments?.find((a) => a.type === 'image')?.payload?.url,
        })),
    );
  }

  /** Our own web chat widget posts this simple shape. */
  static fromWebChat(payload: unknown): InboundMessage[] {
    const p = payload as { userId?: string; name?: string; text?: string; imageUrl?: string; messageId?: string };
    if (!p?.userId) return [];
    return [
      {
        channel: Channel.WEB_CHAT,
        externalUserId: String(p.userId),
        displayName: p.name,
        text: p.text,
        imageUrl: p.imageUrl,
        externalMessageId: p.messageId ? `web:${p.messageId}` : undefined,
      },
    ];
  }
}
