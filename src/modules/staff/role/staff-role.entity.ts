import { Column, Entity, Unique } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

/** Postgres bigint comes back as a string; convert to/from JS bigint. */
export const bigintTransformer = {
  to: (value?: bigint | null): string | null | undefined =>
    value === undefined || value === null ? value : value.toString(),
  from: (value: string | null): bigint => BigInt(value ?? '0'),
};

/** A role = a bitmask of Permission bits (design §16.13). */
@Entity('staff_role')
@Unique('uq_staff_role__code', ['code'])
export class StaffRole extends BaseEntity {
  @Column({ length: 40 })
  code: string;

  @Column({ length: 120 })
  name: string;

  @Column({ type: 'bigint', default: 0, transformer: bigintTransformer })
  permissions: bigint;

  @Column({ default: false })
  isSystem: boolean;
}
