import { Column, Entity } from 'typeorm';
import { EnquiryType, Priority } from '../../../common/constants/enums';
import { BaseEntity } from '../../../common/entities/base.entity';

/** null type/priority = applies to all. The most specific match wins (design §11). */
@Entity('sla_policy')
export class SlaPolicy extends BaseEntity {
  @Column({ type: 'varchar', length: 30, nullable: true })
  enquiryType: EnquiryType | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  priority: Priority | null;

  @Column()
  targetMinutes: number;

  @Column({ default: true })
  isPauseWhenWaiting: boolean;

  @Column({ default: true })
  isActive: boolean;
}
