import { Column, Index, Entity, JoinColumn, ManyToOne, VersionColumn, Unique } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Staff } from '../../staff/profile/staff.entity';

@Entity('customer')
@Unique('uq_customer__code', ['code'])
@Unique('uq_customer__email', ['email'])
export class Customer extends BaseEntity {
  @Column({ length: 30 })
  code: string;

  @Index('idx_customer__company_name_trgm', { synchronize: false }) // GIN trigram, hand-written migration
  @Column({ length: 200 })
  companyName: string;

  @Index('idx_customer__contact_name_trgm', { synchronize: false }) // GIN trigram, hand-written migration
  @Column({ type: 'varchar', length: 120, nullable: true })
  contactName: string | null;

  @Index('idx_customer__phone_trgm', { synchronize: false }) // GIN trigram, hand-written migration
  @Column({ type: 'varchar', length: 30, nullable: true })
  phone: string | null;

  @Index('idx_customer__email_trgm', { synchronize: false }) // GIN trigram, hand-written migration
  @Column({ type: 'varchar', length: 200, nullable: true })
  email: string | null;

  /** null = no app account (e.g. created from a LINE webhook) */
  @Column({ type: 'varchar', length: 255, nullable: true, select: false })
  passwordHash: string | null;

  @Column({ type: 'uuid', nullable: true })
  salespersonStaffId: string | null;

  @ManyToOne(() => Staff, { nullable: true })
  @JoinColumn({
    name: 'salesperson_staff_id',
    foreignKeyConstraintName: 'fk_customer__salesperson_staff_id',
  })
  salesperson: Staff | null;

  @Column({ default: false })
  isPlaceholder: boolean;

  @Column({ type: 'text', nullable: true })
  internalNote: string | null;

  @VersionColumn({ default: 1 })
  version: number;

  @Column({ type: 'timestamptz', nullable: true })
  lastContactAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;
}
