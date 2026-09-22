import { Column, Index, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { Channel } from '../../../common/constants/enums';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Customer } from './customer.entity';

/** A customer's identity on one channel (LINE user id, FB PSID, email, phone). */
@Entity('customer_channel')
@Unique('uq_customer_channel__channel_external_id', ['channel', 'externalId'])
export class CustomerChannel extends BaseEntity {
  @Column('uuid')
  customerId: string;

  @ManyToOne(() => Customer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id', foreignKeyConstraintName: 'fk_customer_channel__customer_id' })
  customer: Customer;

  @Column({ type: 'varchar', length: 20 })
  channel: Channel;

  @Column({ length: 200 })
  externalId: string;

  @Index('idx_customer_channel__display_name_trgm', { synchronize: false }) // GIN trigram, hand-written migration
  @Column({ type: 'varchar', length: 200, nullable: true })
  displayName: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastSeenAt: Date | null;
}
