import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { ChatTag } from './chat-tag.entity';
import { Tag } from './tag.entity';

@Injectable()
export class TagRepository {
  constructor(
    @InjectRepository(Tag) private readonly tags: Repository<Tag>,
    @InjectRepository(ChatTag) private readonly chatTags: Repository<ChatTag>,
  ) {}

  async listWithUsage(): Promise<{ tag: Tag; usage: number }[]> {
    const [rows, counts] = await Promise.all([
      this.tags.find({ order: { name: 'ASC' } }),
      this.chatTags
        .createQueryBuilder('ct')
        .select('ct.tagId', 'tagId')
        .addSelect('COUNT(*)::int', 'n')
        .groupBy('ct.tagId')
        .getRawMany<{ tagId: string; n: number }>(),
    ]);
    const byId = new Map(counts.map((c) => [c.tagId, c.n]));
    return rows.map((tag) => ({ tag, usage: byId.get(tag.id) ?? 0 }));
  }

  findById(id: string): Promise<Tag | null> {
    return this.tags.findOne({ where: { id } });
  }

  findByIds(ids: string[]): Promise<Tag[]> {
    return ids.length ? this.tags.find({ where: { id: In(ids) } }) : Promise.resolve([]);
  }

  findByName(name: string): Promise<Tag | null> {
    return this.tags.createQueryBuilder('tag').where('lower(tag.name) = lower(:name)', { name }).getOne();
  }

  save(tag: Partial<Tag>): Promise<Tag> {
    return this.tags.save(tag);
  }

  async delete(id: string): Promise<void> {
    await this.tags.delete(id); // chat_tag rows go with it (ON DELETE CASCADE)
  }

  /** chatId → its tags, for list pages (one query). */
  async findForChats(chatIds: string[]): Promise<Map<string, Tag[]>> {
    const map = new Map<string, Tag[]>();
    if (!chatIds.length) return map;
    const rows = await this.chatTags.find({
      where: { chatId: In(chatIds) },
      relations: { tag: true },
      order: { createdAt: 'ASC' },
    });
    for (const r of rows) map.set(r.chatId, [...(map.get(r.chatId) ?? []), r.tag]);
    return map;
  }

  /** Replace the chat's tag set inside the caller's transaction. */
  async replaceForChat(m: EntityManager, chatId: string, tagIds: string[]): Promise<void> {
    await m.getRepository(ChatTag).delete({ chatId });
    if (tagIds.length) {
      await m.getRepository(ChatTag).insert(tagIds.map((tagId) => ({ chatId, tagId })));
    }
  }
}
