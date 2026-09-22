import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { normalizeMask } from '../../../common/permissions/permission-mask.util';
import { RealtimePublisher, rooms } from '../../../common/realtime/realtime.publisher';
import { StaffService } from '../profile/staff.service';
import { CreateRoleDto, RoleDto, UpdateRoleDto } from '../staff.dto';
import { StaffRole } from './staff-role.entity';

/** bit 63 is the sign bit of Postgres bigint; masks above it can't be stored. */
const MAX_MASK = (1n << 63n) - 1n;

/** Custom roles = a name + a permission bitmask (design §16.13). */
@Injectable()
export class RoleService {
  constructor(
    @InjectRepository(StaffRole) private readonly repo: Repository<StaffRole>,
    private readonly staff: StaffService,
    private readonly realtime: RealtimePublisher,
  ) {}

  async list(): Promise<RoleDto[]> {
    const rows = await this.repo
      .createQueryBuilder('role')
      .addSelect(
        '(SELECT COUNT(*)::int FROM staff s WHERE s.role_id = role.id AND s.is_active)',
        'staff_count',
      )
      .orderBy('role.createdAt', 'ASC')
      .getRawAndEntities<{ role_id: string; staff_count: number }>();
    const counts = new Map(rows.raw.map((r) => [r.role_id, r.staff_count]));
    return rows.entities.map((r) => RoleDto.from(r, counts.get(r.id) ?? 0));
  }

  async create(dto: CreateRoleDto): Promise<RoleDto> {
    const name = dto.name.trim();
    const code = await this.uniqueCode(name);
    const saved = await this.repo.save({ code, name, permissions: this.parseMask(dto.permissions), isSystem: false });
    this.announce(saved.id, 'created');
    return RoleDto.from(saved, 0);
  }

  /**
   * Saving applies "edit implies view" and drops the 60s actor cache of everyone in the role, so the
   * change takes effect on their next request (and their screens refetch via the realtime event).
   */
  async update(id: string, dto: UpdateRoleDto): Promise<RoleDto> {
    const role = await this.repo.findOne({ where: { id } });
    if (!role) throw new NotFoundException('role.notFound');
    if (dto.name !== undefined) role.name = dto.name.trim();
    if (dto.permissions !== undefined) role.permissions = this.parseMask(dto.permissions);
    await this.repo.save(role);
    await this.staff.forgetActorsOfRole(id);
    this.announce(id, 'updated');
    return (await this.list()).find((r) => r.id === id)!;
  }

  private parseMask(value: string): bigint {
    const mask = BigInt(value);
    if (mask < 0n || mask > MAX_MASK) throw new ConflictException('role.invalidPermissions');
    return normalizeMask(mask);
  }

  /** AGENT, SUPERVISOR… are seeded; custom roles get CUSTOM_<n>. */
  private async uniqueCode(name: string): Promise<string> {
    const base = `CUSTOM_${name.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '') || 'ROLE'}`.slice(0, 34);
    for (let i = 1; ; i++) {
      const code = i === 1 ? base : `${base}_${i}`;
      if (!(await this.repo.findOne({ where: { code } }))) return code;
    }
  }

  private announce(id: string, action: 'created' | 'updated') {
    this.realtime.emit('role.changed', [rooms.allStaff], { entity: 'staff_role', id, action });
  }
}
