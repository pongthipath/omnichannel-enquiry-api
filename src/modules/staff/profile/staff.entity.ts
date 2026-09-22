import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Department } from '../department/department.entity';
import { StaffRole } from '../role/staff-role.entity';

@Entity('staff')
@Unique('uq_staff__email', ['email'])
@Index('idx_staff__department_id', ['departmentId'])
export class Staff extends BaseEntity {
  @Column({ length: 200 })
  email: string;

  @Column({ type: 'varchar', length: 255, select: false })
  passwordHash: string;

  @Column({ length: 120 })
  name: string;

  @Column('uuid')
  roleId: string;

  @ManyToOne(() => StaffRole)
  @JoinColumn({ name: 'role_id', foreignKeyConstraintName: 'fk_staff__role_id' })
  role: StaffRole;

  @Column('uuid')
  departmentId: string;

  @ManyToOne(() => Department)
  @JoinColumn({ name: 'department_id', foreignKeyConstraintName: 'fk_staff__department_id' })
  department: Department;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', default: {} })
  uiPreferences: Record<string, unknown>;

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;
}
