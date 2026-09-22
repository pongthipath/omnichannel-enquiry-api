import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Actor, isStaff } from '../../../common/auth/actor';
import { Permission } from '../../../common/permissions/permission.enum';
import { RealtimePublisher, rooms } from '../../../common/realtime/realtime.publisher';
import { CreateTagDto, TagDto, UpdateTagDto } from './tag.dto';
import { Tag, TagAppliesTo, TagColor } from './tag.entity';
import { TagRepository } from './tag.repository';

export const TagEvent = { CHANGED: 'tag.changed' } as const;

/** Tag CRUD (settings page) + inline create from the chat (design §5 v12). */
@Injectable()
export class TagService {
  constructor(
    private readonly tags: TagRepository,
    private readonly realtime: RealtimePublisher,
  ) {}

  async list(): Promise<TagDto[]> {
    return (await this.tags.listWithUsage()).map(({ tag, usage }) => TagDto.withUsage(tag, usage));
  }

  async create(actor: Actor, dto: CreateTagDto): Promise<TagDto> {
    if (
      !isStaff(actor) ||
      !(actor.can(Permission.SETTINGS_TAG_MANAGE) || actor.can(Permission.INBOX_TAG_CREATE_INLINE))
    ) {
      throw new ForbiddenException('auth.forbidden');
    }
    const name = dto.name.trim();
    if (await this.tags.findByName(name)) throw new ConflictException('tag.duplicateName');
    const tag = await this.tags.save({
      name,
      color: dto.color ?? TagColor.BLUE,
      appliesTo: dto.appliesTo ?? TagAppliesTo.ENQUIRY,
      description: dto.description?.trim() || null,
      createdByStaffId: actor.id,
    });
    this.announce(tag.id, 'created');
    return TagDto.withUsage(tag, 0);
  }

  async update(id: string, dto: UpdateTagDto): Promise<TagDto> {
    const tag = await this.getOrThrow(id);
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      const clash = await this.tags.findByName(name);
      if (clash && clash.id !== id) throw new ConflictException('tag.duplicateName');
      tag.name = name;
    }
    if (dto.color !== undefined) tag.color = dto.color;
    if (dto.appliesTo !== undefined) tag.appliesTo = dto.appliesTo;
    if (dto.description !== undefined) tag.description = dto.description.trim() || null;
    const saved = await this.tags.save(tag);
    this.announce(id, 'updated');
    const usage = (await this.tags.listWithUsage()).find((r) => r.tag.id === id)?.usage ?? 0;
    return TagDto.withUsage(saved, usage);
  }

  async remove(id: string): Promise<void> {
    await this.getOrThrow(id);
    await this.tags.delete(id);
    this.announce(id, 'deleted');
  }

  /** Tags that exist and may go on an enquiry — rejects unknown ids and customer-only tags. */
  async assertApplicableToEnquiry(tagIds: string[]): Promise<void> {
    const unique = [...new Set(tagIds)];
    const found = await this.tags.findByIds(unique);
    if (found.length !== unique.length) throw new BadRequestException('tag.notFound');
    if (found.some((t) => t.appliesTo === TagAppliesTo.CUSTOMER)) {
      throw new BadRequestException('tag.notForEnquiry');
    }
  }

  private async getOrThrow(id: string): Promise<Tag> {
    const tag = await this.tags.findById(id);
    if (!tag) throw new NotFoundException('tag.notFound');
    return tag;
  }

  /** Every staff screen with tag pickers refreshes (realtime everywhere, design v13). */
  private announce(id: string, action: 'created' | 'updated' | 'deleted') {
    this.realtime.emit(TagEvent.CHANGED, [rooms.allStaff], { entity: 'tag', id, action });
  }
}
