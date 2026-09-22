import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { In, Repository } from 'typeorm';
import { RealtimePublisher, rooms } from '../../../common/realtime/realtime.publisher';
import { CreateStaffDto, StaffDetailDto, UpdateStaffDto } from '../staff.dto';
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
    private readonly realtime: RealtimePublisher,
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

  /** Includes inactive staff — old enquiries still show who handled them. */
  findByIds(ids: string[]): Promise<Staff[]> {
    return ids.length ? this.staffRepo.find({ where: { id: In(ids) } }) : Promise.resolve([]);
  }

  // ---------- settings page (SETTINGS_STAFF_MANAGE) ----------

  async listForSettings(): Promise<StaffDetailDto[]> {
    const rows = await this.staffRepo.find({
      relations: { role: true, department: true },
      order: { isActive: 'DESC', name: 'ASC' },
    });
    return rows.map(StaffDetailDto.fromFull);
  }

  async create(dto: CreateStaffDto): Promise<StaffDetailDto> {
    const email = dto.email.trim().toLowerCase();
    if (await this.findForLogin(email)) throw new ConflictException('staff.duplicateEmail');
    const saved = await this.staffRepo.save({
      email,
      name: dto.name.trim(),
      departmentId: dto.departmentId,
      roleId: dto.roleId,
      passwordHash: await argon2.hash(dto.password, { type: argon2.argon2id }),
    });
    this.announce(saved.id, 'created');
    return this.detail(saved.id);
  }

  /** Changing role / department / active takes effect on the person's next request (cache dropped). */
  async update(actorId: string, id: string, dto: UpdateStaffDto): Promise<StaffDetailDto> {
    const staff = await this.staffRepo.findOne({ where: { id } });
    if (!staff) throw new NotFoundException('staff.notFound');
    if (id === actorId && dto.isActive === false) throw new ConflictException('staff.cannotDisableSelf');
    if (dto.name !== undefined) staff.name = dto.name.trim();
    if (dto.departmentId !== undefined) staff.departmentId = dto.departmentId;
    if (dto.roleId !== undefined) staff.roleId = dto.roleId;
    if (dto.isActive !== undefined) staff.isActive = dto.isActive;
    await this.staffRepo.save(staff);
    await this.forgetActor(id);
    this.announce(id, 'updated');
    return this.detail(id);
  }

  async forgetActorsOfRole(roleId: string): Promise<void> {
    const rows = await this.staffRepo.find({ where: { roleId }, select: { id: true } });
    await Promise.all(rows.map((r) => this.forgetActor(r.id)));
  }

  private async detail(id: string): Promise<StaffDetailDto> {
    const s = await this.staffRepo.findOne({ where: { id }, relations: { role: true, department: true } });
    return StaffDetailDto.fromFull(s!);
  }

  private announce(id: string, action: 'created' | 'updated') {
    this.realtime.emit('staff.changed', [rooms.allStaff], { entity: 'staff', id, action });
  }

  private toActor(v: CachedActor): StaffActor {
    return new StaffActor(v.id, v.departmentId, v.roleId, v.name, BigInt(v.mask));
  }
}
