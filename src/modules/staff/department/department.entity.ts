import { Column, Entity, Index, Unique } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

/** Departments are user-editable (design §5 v5): deactivate instead of delete. */
@Entity('department')
@Unique('uq_department__code', ['code'])
@Index('uq_department__is_default', ['isDefault'], { unique: true, where: 'is_default' })
export class Department extends BaseEntity {
  @Column({ length: 40 })
  code: string;

  @Column({ length: 120 })
  nameTh: string;

  @Column({ length: 120 })
  nameEn: string;

  @Column({ default: false })
  isDefault: boolean;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: 0 })
  sortOrder: number;
}
