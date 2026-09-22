import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EnquiryType, Priority } from '../../../common/constants/enums';
import { RedisService } from '../../../common/redis/redis.service';
import { SlaPolicy } from './sla-policy.entity';
import { addMinutes, resolveSlaMinutes, SlaRule } from './sla-policy.resolver';

const CACHE_KEY = 'sla:policies';

@Injectable()
export class SlaService {
  constructor(
    @InjectRepository(SlaPolicy) private readonly repo: Repository<SlaPolicy>,
    private readonly redis: RedisService,
  ) {}

  /** SLA snapshot for a new (or reopened) enquiry — later policy edits don't change open chats. */
  async targetFor(type: EnquiryType, priority: Priority, from = new Date()) {
    const minutes = resolveSlaMinutes(await this.rules(), type, priority);
    return { slaMinutes: minutes, slaDueAt: addMinutes(from, minutes) };
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
