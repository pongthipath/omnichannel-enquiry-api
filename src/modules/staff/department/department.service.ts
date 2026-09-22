import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { RealtimePublisher, rooms } from '../../../common/realtime/realtime.publisher';
import { CreateDepartmentDto, DepartmentDto, UpdateDepartmentDto } from '../staff.dto';
import { Department } from './department.entity';

@Injectable()
export class DepartmentService {
  constructor(
    @InjectRepository(Department) private readonly repo: Repository<Department>,
    private readonly dataSource: DataSource,
    private readonly realtime: RealtimePublisher,
  ) {}

  listActive(): Promise<Department[]> {
    return this.repo.find({ where: { isActive: true }, order: { sortOrder: 'ASC' } });
  }

  /** Settings page: every department (inactive too) with its number of active staff. */
  async listForSettings(): Promise<DepartmentDto[]> {
    const rows = await this.repo
      .createQueryBuilder('department')
      .addSelect(
        '(SELECT COUNT(*)::int FROM staff s WHERE s.department_id = department.id AND s.is_active)',
        'staff_count',
      )
      .orderBy('department.isActive', 'DESC')
      .addOrderBy('department.sortOrder', 'ASC')
      .getRawAndEntities<{ department_id: string; staff_count: number }>();
    const counts = new Map(rows.raw.map((r) => [r.department_id, r.staff_count]));
    return rows.entities.map((d) => DepartmentDto.from(d, counts.get(d.id) ?? 0));
  }

  /** Department that receives new enquiries (exactly one has is_default). */
  async getDefault(): Promise<Department> {
    const dept = await this.repo.findOne({ where: { isDefault: true, isActive: true } });
    if (!dept) throw new InternalServerErrorException('department.noDefault');
    return dept;
  }

  findActiveById(id: string): Promise<Department | null> {
    return this.repo.findOne({ where: { id, isActive: true } });
  }

  /** Includes inactive ones — enquiries keep showing the department they were in. */
  findByIds(ids: string[]): Promise<Department[]> {
    return ids.length ? this.repo.find({ where: { id: In(ids) } }) : Promise.resolve([]);
  }

  async create(dto: CreateDepartmentDto): Promise<DepartmentDto> {
    if (await this.repo.findOne({ where: { code: dto.code } })) {
      throw new ConflictException('department.duplicateCode');
    }
    const saved = await this.dataSource.transaction(async (m) => {
      if (dto.isDefault) await this.clearDefault(m.getRepository(Department));
      return m.getRepository(Department).save({
        code: dto.code,
        nameTh: dto.nameTh.trim(),
        nameEn: dto.nameEn.trim(),
        isDefault: dto.isDefault ?? false,
        sortOrder: dto.sortOrder ?? (await this.repo.count()),
      });
    });
    this.announce(saved.id, 'created');
    return DepartmentDto.from(saved, 0);
  }

  /** Exactly one default at all times: setting a new one clears the old; the default can't be switched off. */
  async update(id: string, dto: UpdateDepartmentDto): Promise<DepartmentDto> {
    const dept = await this.repo.findOne({ where: { id } });
    if (!dept) throw new NotFoundException('department.notFound');
    if (dept.isDefault && (dto.isDefault === false || dto.isActive === false)) {
      throw new ConflictException('department.defaultRequired');
    }
    await this.dataSource.transaction(async (m) => {
      const repo = m.getRepository(Department);
      if (dto.isDefault && !dept.isDefault) await this.clearDefault(repo);
      if (dto.nameTh !== undefined) dept.nameTh = dto.nameTh.trim();
      if (dto.nameEn !== undefined) dept.nameEn = dto.nameEn.trim();
      if (dto.isDefault !== undefined) dept.isDefault = dto.isDefault;
      if (dto.isActive !== undefined) dept.isActive = dto.isActive;
      if (dto.sortOrder !== undefined) dept.sortOrder = dto.sortOrder;
      await repo.save(dept);
    });
    this.announce(id, 'updated');
    return (await this.listForSettings()).find((d) => d.id === id)!;
  }

  private async clearDefault(repo: Repository<Department>): Promise<void> {
    await repo.update({ isDefault: true }, { isDefault: false });
  }

  private announce(id: string, action: 'created' | 'updated') {
    this.realtime.emit('department.changed', [rooms.allStaff], { entity: 'department', id, action });
  }
}
