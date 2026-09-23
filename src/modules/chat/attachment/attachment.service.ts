import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { Readable } from 'node:stream';
import { EntityManager } from 'typeorm';
import { Actor, isStaff } from '../../../common/auth/actor';
import { Permission } from '../../../common/permissions/permission.enum';
import { StorageService } from '../../../common/storage/storage.service';
import { ChatAccessPolicy } from '../enquiry/chat-access.policy';
import { ChatRepository } from '../enquiry/chat.repository';
import { ChatMessageRepository } from '../message/chat-message.repository';
import { AttachmentDto } from './attachment.dto';
import { AttachmentKind, AttachmentStatus, ChatMessageAttachment } from './chat-message-attachment.entity';
import { AttachmentRepository } from './attachment.repository';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
const MIRROR_BATCH = 20;
const MIRROR_MAX_ATTEMPTS = 5;
const ALLOWED = /^(image\/(jpeg|png|gif|webp|heic)|application\/pdf|text\/plain)$/;

/**
 * Files of a message (design §9). Two ways in:
 * - staff / customer upload → stored in our bucket right away (STORED)
 * - webhook image → only the channel's URL is known (PENDING); `mirrorPending()` in the worker
 *   downloads it into our bucket later, so the chat works immediately and the file survives the
 *   channel's short-lived links.
 */
@Injectable()
export class AttachmentService {
  private readonly logger = new Logger(AttachmentService.name);

  constructor(
    private readonly attachments: AttachmentRepository,
    private readonly storage: StorageService,
    private readonly messages: ChatMessageRepository,
    private readonly chats: ChatRepository,
  ) {}

  async upload(actor: Actor, file: Express.Multer.File): Promise<AttachmentDto> {
    if (!file) throw new BadRequestException('attachment.fileRequired');
    if (file.size > MAX_UPLOAD_BYTES) throw new BadRequestException('attachment.tooLarge');
    if (!ALLOWED.test(file.mimetype)) throw new BadRequestException('attachment.unsupportedType');

    const key = `attachments/${new Date().toISOString().slice(0, 10)}/${randomUUID()}${extname(file.originalname) || ''}`;
    await this.storage.put(key, file.buffer, file.mimetype);
    const saved = await this.attachments.create({
      kind: file.mimetype.startsWith('image/') ? AttachmentKind.IMAGE : AttachmentKind.FILE,
      fileName: file.originalname.slice(0, 200),
      mimeType: file.mimetype,
      sizeBytes: file.size,
      storageKey: key,
      status: AttachmentStatus.STORED,
      uploadedById: actor.id,
    });
    return AttachmentDto.from(saved);
  }

  /** Webhook path: keep the channel's URL now, mirror later. */
  createFromUrl(
    manager: EntityManager,
    values: { url: string; mimeType: string; fileName: string; kind?: AttachmentKind },
  ): Promise<ChatMessageAttachment> {
    return this.attachments.create(
      {
        kind: values.kind ?? (values.mimeType.startsWith('image/') ? AttachmentKind.IMAGE : AttachmentKind.FILE),
        fileName: values.fileName.slice(0, 200),
        mimeType: values.mimeType,
        sourceUrl: values.url,
        status: AttachmentStatus.PENDING,
      },
      manager,
    );
  }

  /** Only files that are not on a message yet may be attached, so nobody can move someone else's file. */
  async attachToMessage(manager: EntityManager, ids: string[], messageId: string): Promise<void> {
    if (!ids.length) return;
    const found = await this.attachments.findByIds(ids);
    if (found.length !== ids.length) throw new BadRequestException('attachment.notFound');
    if (found.some((a) => a.chatMessageId && a.chatMessageId !== messageId)) {
      throw new BadRequestException('attachment.alreadyUsed');
    }
    await this.attachments.attachToMessage(manager, ids, messageId);
  }

  async findForMessages(messageIds: string[]): Promise<Map<string, ChatMessageAttachment[]>> {
    return this.attachments.findForMessages(messageIds);
  }

  /** The files a send() is about to attach — the message type follows their kind. */
  findByIdsForSend(ids: string[]): Promise<ChatMessageAttachment[]> {
    return this.attachments.findByIds(ids);
  }

  /** A signed link already proves the server handed this file out; no actor to check. */
  async getById(id: string): Promise<ChatMessageAttachment> {
    const attachment = await this.attachments.findById(id);
    if (!attachment) throw new NotFoundException('attachment.notFound');
    return attachment;
  }

  /**
   * A file may be read by anyone who may read its chat; a file not on a message yet only by the
   * person who uploaded it. 404 (not 403) so ids can't be probed.
   */
  async getVisible(actor: Actor, id: string): Promise<ChatMessageAttachment> {
    const attachment = await this.attachments.findById(id);
    if (!attachment) throw new NotFoundException('attachment.notFound');

    if (!attachment.chatMessageId) {
      if (attachment.uploadedById !== actor.id) throw new NotFoundException('attachment.notFound');
      return attachment;
    }
    const message = await this.messages.findById(attachment.chatMessageId);
    const chat = message && (await this.chats.findById(message.chatId));
    if (!chat || !ChatAccessPolicy.canView(actor, chat)) throw new NotFoundException('attachment.notFound');
    if (message.isInternal && !(isStaff(actor) && actor.can(Permission.INBOX_CHAT_INTERNAL_VIEW))) {
      throw new NotFoundException('attachment.notFound');
    }
    return attachment;
  }

  /** Bytes for `GET /attachments/:id/file` — from our bucket, or straight from the channel while PENDING. */
  async openStream(attachment: ChatMessageAttachment): Promise<{ stream: Readable; mimeType: string }> {
    if (attachment.storageKey) {
      return { stream: await this.storage.getStream(attachment.storageKey), mimeType: attachment.mimeType };
    }
    if (!attachment.sourceUrl) throw new NotFoundException('attachment.notFound');
    const { body, contentType } = await this.storage.fetchExternal(attachment.sourceUrl, MAX_UPLOAD_BYTES);
    return { stream: Readable.from(body), mimeType: contentType };
  }

  /**
   * Worker job: copy pending files into our bucket. Each failure is counted; after
   * MIRROR_MAX_ATTEMPTS the row is marked FAILED and the chat keeps showing the channel URL.
   */
  async mirrorPending(): Promise<{ mirrored: number; failed: number }> {
    const rows = await this.attachments.pendingMirrors(MIRROR_BATCH, MIRROR_MAX_ATTEMPTS);
    let mirrored = 0;
    let failed = 0;
    for (const row of rows) {
      try {
        const { body, contentType } = await this.storage.fetchExternal(row.sourceUrl!, MAX_UPLOAD_BYTES);
        const key = `attachments/mirrored/${row.id}`;
        await this.storage.put(key, body, contentType);
        row.storageKey = key;
        row.mimeType = contentType;
        row.sizeBytes = body.byteLength;
        row.status = AttachmentStatus.STORED;
        row.lastError = null;
        mirrored++;
      } catch (e) {
        row.mirrorAttempts += 1;
        row.lastError = (e as Error).message.slice(0, 300);
        if (row.mirrorAttempts >= MIRROR_MAX_ATTEMPTS) {
          row.status = AttachmentStatus.FAILED;
          failed++;
          this.logger.warn(`attachment ${row.id} gave up after ${row.mirrorAttempts}: ${row.lastError}`);
        }
      }
      await this.attachments.save(row);
    }
    return { mirrored, failed };
  }
}
