import { HttpException, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Actor } from '../../common/auth/actor';
import { CreateEnquiryDto } from '../chat/enquiry/enquiry.dto';
import { EnquiryService } from '../chat/enquiry/enquiry.service';
import { SendMessageDto } from '../chat/message/message.dto';
import { MessageService } from '../chat/message/message.service';
import { SyncItemDto, SyncResultDto } from './sync.dto';

/**
 * Batch endpoint for the mobile outbox (design §7). Items are processed in order, each on its own
 * (one bad item doesn't block the rest). Every op is idempotent, so a batch can be re-sent safely —
 * after an app kill, a lost response, or a manual "force re-sync".
 */
@Injectable()
export class SyncService {
  constructor(
    private readonly enquiries: EnquiryService,
    private readonly messages: MessageService,
  ) {}

  async sync(actor: Actor, items: SyncItemDto[]): Promise<SyncResultDto[]> {
    const results: SyncResultDto[] = [];
    for (const item of items) results.push(await this.process(actor, item));
    return results;
  }

  private async process(actor: Actor, item: SyncItemDto): Promise<SyncResultDto> {
    try {
      if (item.op === 'conversation.create') {
        const dto = await this.validated(CreateEnquiryDto, {
          ...item.payload,
          clientRequestId: item.clientId,
        });
        const { enquiry, created } = await this.enquiries.create(actor, dto);
        return {
          clientId: item.clientId,
          status: created ? 'created' : 'duplicate',
          serverId: enquiry.id,
          reference: enquiry.reference,
        };
      }
      const conversationId = String(item.payload.conversationId ?? '');
      const dto = await this.validated(SendMessageDto, {
        body: item.payload.body,
        clientMessageId: item.clientId,
      });
      const { message, created } = await this.messages.send(actor, conversationId, dto);
      return {
        clientId: item.clientId,
        status: created ? 'created' : 'duplicate',
        serverId: message.id,
      };
    } catch (e) {
      const status = e instanceof HttpException ? e.getStatus() : 500;
      const code =
        e instanceof HttpException
          ? String((e.getResponse() as { message?: unknown }).message ?? e.message)
          : 'common.internal';
      // 4xx = the item itself is wrong → the app should stop retrying and show it to the user
      return { clientId: item.clientId, status: 'failed', error: code, retryable: status >= 500 };
    }
  }

  private async validated<T extends object>(
    cls: new () => T,
    plain: Record<string, unknown>,
  ): Promise<T> {
    const instance = plainToInstance(cls, plain);
    const errors = await validate(instance, { whitelist: true, forbidNonWhitelisted: true });
    if (errors.length) throw new HttpException('common.validation', 400);
    return instance;
  }
}
