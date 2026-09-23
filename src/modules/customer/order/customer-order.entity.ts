import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { decimalTransformer } from '../../../common/utils/decimal.util';
import { Customer } from '../profile/customer.entity';

export enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  DELIVERING = 'DELIVERING',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

/**
 * Orders shown in the Customer 360 panel (design §12). Read-only here — the ERP owns them; we keep
 * the few fields staff need while answering "where is my order?".
 */
@Entity('customer_order')
@Unique('uq_customer_order__order_no', ['orderNo'])
@Index('idx_customer_order__customer_id_ordered_at', ['customerId', 'orderedAt'])
export class CustomerOrder extends BaseEntity {
  @Column('uuid')
  customerId: string;

  @ManyToOne(() => Customer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id', foreignKeyConstraintName: 'fk_customer_order__customer_id' })
  customer: Customer;

  @Column({ length: 40 })
  orderNo: string;

  @Column({ type: 'timestamptz' })
  orderedAt: Date;

  @Column({ type: 'varchar', length: 20 })
  status: OrderStatus;

  @Column({ type: 'numeric', precision: 12, scale: 2, transformer: decimalTransformer })
  totalAmount: string;

  @Column({ length: 3, default: 'THB' })
  currency: string;

  @Column({ type: 'varchar', length: 300, nullable: true })
  itemsSummary: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  deliveredAt: Date | null;
}
