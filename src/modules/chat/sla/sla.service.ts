import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ChatStatus, EnquiryType, Priority } from '../../../common/constants/enums';
import { RedisService } from '../../../common/redis/redis.service';
import { RealtimePublisher, rooms } from '../../../common/realtime/realtime.publisher';
import { ChatEvent, chatRooms } from '../chat-events';
import { Chat } from '../enquiry/chat.entity';
import { CreateSlaPolicyDto, SlaPolicyDto, UpdateSlaPolicyDto } from './sla.dto';
import { SlaPolicy } from './sla-policy.entity';
import { addMinutes, resolveSlaMinutes, SlaRule } from './sla-policy.resolver';

const CACHE_KEY = 'sla:policies';

@Injectable()
export class SlaService {
  constructor(
    @InjectRepository(SlaPolicy) private readonly repo: Repository<SlaPolicy>,
    private readonly redis: RedisService,
    private readonly realtime: RealtimePublisher,
  ) {}

  /** SLA snapshot for a new (or reopened) enquiry — later policy edits don't change open chats. */
  async targetFor(type: EnquiryType, priority: Priority, from = new Date()) {
    const minutes = resolveSlaMinutes(await this.rules(), type, priority);
    return { slaMinutes: minutes, slaDueAt: addMinutes(from, minutes) };
  }

  // ---------- settings page (SETTINGS_SLA_VIEW / EDIT) ----------

  async list(): Promise<SlaPolicyDto[]> {
    const rows = await this.repo.find({ order: { enquiryType: 'ASC', priority: 'ASC' } });
    return rows.map(SlaPolicyDto.from);
  }

  async create(dto: CreateSlaPolicyDto): Promise<SlaPolicyDto> {
    const clash = await this.repo.findOne({
      where: { enquiryType: dto.enquiryType ?? IsNull(), priority: dto.priority ?? IsNull() },
    });
    if (clash) throw new ConflictException('sla.duplicateRule');
    const saved = await this.repo.save({
      enquiryType: dto.enquiryType ?? null,
      priority: dto.priority ?? null,
      targetMinutes: dto.targetMinutes,
      isPauseWhenWaiting: dto.isPauseWhenWaiting ?? true,
    });
    await this.invalidate();
    return SlaPolicyDto.from(saved);
  }

  /** Editing a rule changes future enquiries only — open ones keep the target they started with. */
  async update(id: string, dto: UpdateSlaPolicyDto): Promise<SlaPolicyDto> {
    const policy = await this.repo.findOne({ where: { id } });
    if (!policy) throw new NotFoundException('sla.notFound');
    if (dto.targetMinutes !== undefined) policy.targetMinutes = dto.targetMinutes;
    if (dto.isPauseWhenWaiting !== undefined) policy.isPauseWhenWaiting = dto.isPauseWhenWaiting;
    if (dto.isActive !== undefined) policy.isActive = dto.isActive;
    const saved = await this.repo.save(policy);
    await this.invalidate();
    this.realtime.emit('sla.changed', [rooms.allStaff], { entity: 'sla_policy', id, action: 'updated' });
    return SlaPolicyDto.from(saved);
  }

  /**
   * Worker job: flag enquiries whose target passed while nobody answered. Paused (waiting for the
   * customer) and finished ones are skipped. Each newly flagged chat is pushed to the open screens.
   */
  async markBreached(): Promise<number> {
    const result = await this.repo.manager
      .createQueryBuilder()
      .update(Chat)
      .set({ isSlaBreached: true })
      .where('is_sla_breached = false')
      .andWhere('sla_paused_at IS NULL')
      .andWhere('sla_due_at < now()')
      .andWhere('status NOT IN (:...done)', { done: [ChatStatus.RESOLVED, ChatStatus.CLOSED] })
      .returning(['id', 'customer_id', 'assigned_staff_id', 'department_id'])
      .execute();

    const rows = (result.raw ?? []) as {
      id: string;
      customer_id: string;
      assigned_staff_id: string | null;
      department_id: string;
    }[];
    for (const row of rows) {
      this.realtime.emit(
        ChatEvent.CHAT_UPDATED,
        chatRooms(
          {
            customerId: row.customer_id,
            assignedStaffId: row.assigned_staff_id,
            departmentId: row.department_id,
          },
          { includeCustomer: false },
        ),
        { entity: 'chat', id: row.id, action: 'updated' },
      );
    }
    return rows.length;
  }

  private async invalidate(): Promise<void> {
    await this.redis.del(CACHE_KEY);
  }

  private async rules(): Promise<SlaRule[]> {
    const cached = await this.redis.getJson<SlaRule[]>(CACHE_KEY);
    if (cached) return cached;
    const rules = (await this.repo.find({ where: { isActive: true } })).map((p) => ({
      enquiryType: p.enquiryType,
      priority: p.priority,
      targetMinutes: p.targetMinutes,
    }));
    await this.redis.setJson(CACHE_KEY, rules, 300);
    return rules;
  }
}
