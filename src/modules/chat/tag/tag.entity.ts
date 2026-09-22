import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

export enum TagColor {
  YELLOW = 'yellow',
  BLUE = 'blue',
  RED = 'red',
  GREEN = 'green',
  CYAN = 'cyan',
  GRAY = 'gray',
  PURPLE = 'purple',
}

export enum TagAppliesTo {
  ENQUIRY = 'ENQUIRY',
  CUSTOMER = 'CUSTOMER',
  BOTH = 'BOTH',
}

/** Labels the team creates itself (design §5 v12). Colors are palette keys, not hex, so themes can map them. */
@Entity('tag')
@Index('uq_tag__name_lower', { synchronize: false }) // unique lower(name), hand-written in the migration
export class Tag extends BaseEntity {
  @Column({ length: 60 })
  name: string;

  @Column({ type: 'varchar', length: 20, default: TagColor.BLUE })
  color: TagColor;

  @Column({ type: 'varchar', length: 10, default: TagAppliesTo.ENQUIRY })
  appliesTo: TagAppliesTo;

  @Column({ type: 'varchar', length: 300, nullable: true })
  description: string | null;

  @Column({ type: 'uuid', nullable: true })
  createdByStaffId: string | null;
}
