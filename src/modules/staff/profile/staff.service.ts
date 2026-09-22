import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StaffActor } from '../../../common/auth/actor';
import { ActorResolver } from '../../../common/auth/actor-resolver';
import { RedisService } from '../../../common/redis/redis.service';
import { Staff } from './staff.entity';

interface CachedActor {
  id: string;
  departmentId: string;
  roleId: string;
  name: string;
  mask: string;
}

const ACTOR_TTL_SECONDS = 60;
export const actorCacheKey = (staffId: string) => `actor:staff:${staffId}`;

/** Facade of the staff module for other modules (auth, chat). */
@Injectable()
export class StaffService implements ActorResolver {
  constructor(
    @InjectRepository(Staff) private readonly staffRepo: Repository<Staff>,
    private readonly redis: RedisService,
  ) {}

  /** Cached 60s; invalidate with `forgetActor` when a role/staff changes (realtime §10.1). */
  async resolveStaff(staffId: string): Promise<StaffActor | null> {
    const cached = await this.redis.getJson<CachedActor>(actorCacheKey(staffId));
    if (cached) return this.toActor(cached);

    const staff = await this.staffRepo.findOne({
      where: { id: staffId, isActive: true },
      relations: { role: true },
    });
    if (!staff) return null;

    const value: CachedActor = {
      id: staff.id,
      departmentId: staff.departmentId,
      roleId: staff.roleId,
      name: staff.name,
      mask: staff.role.permissions.toString(),
    };
    await this.redis.setJson(actorCacheKey(staffId), value, ACTOR_TTL_SECONDS);
    return this.toActor(value);
  }

  async forgetActor(staffId: string): Promise<void> {
    await this.redis.del(actorCacheKey(staffId));
  }

  /** Includes the password hash — only for the auth module. */
  findForLogin(email: string): Promise<Staff | null> {
    return this.staffRepo
      .createQueryBuilder('staff')
      .addSelect('staff.passwordHash')
      .where('lower(staff.email) = lower(:email)', { email })
      .getOne();
  }

  async touchLogin(staffId: string): Promise<void> {
    await this.staffRepo.update(staffId, { lastLoginAt: new Date() });
  }

  findActive(departmentId?: string): Promise<Staff[]> {
    return this.staffRepo.find({
      where: { isActive: true, ...(departmentId ? { departmentId } : {}) },
      order: { name: 'ASC' },
    });
  }

  findById(id: string): Promise<Staff | null> {
    return this.staffRepo.findOne({ where: { id } });
  }

  private toActor(v: CachedActor): StaffActor {
    return new StaffActor(v.id, v.departmentId, v.roleId, v.name, BigInt(v.mask));
  }
}
