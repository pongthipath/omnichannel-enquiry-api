import { Column, Entity, Index, JoinColumn, ManyToOne, Unique, VersionColumn } from 'typeorm';
import {
  Channel,
  ChatStatus,
  EnquiryType,
  Priority,
  SenderType,
} from '../../../common/constants/enums';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Product } from '../../catalog/product.entity';
import { Customer } from '../../customer/profile/customer.entity';
import { Department } from '../../staff/department/department.entity';
import { Staff } from '../../staff/profile/staff.entity';

/** 1 chat = 1 enquiry (design §5). */
@Entity('chat')
@Unique('uq_chat__reference', ['reference'])
@Unique('uq_chat__customer_id_client_request_id', ['customerId', 'clientRequestId'])
@Index('idx_chat__status_last_message_at', ['status', 'lastMessageAt'])
@Index('idx_chat__assigned_staff_id_status', ['assignedStaffId', 'status'])
@Index('idx_chat__department_id_status', ['departmentId', 'status'])
@Index('idx_chat__customer_id_last_message_at', ['customerId', 'lastMessageAt'])
@Index('idx_chat__product_id', ['productId'])
export class Chat extends BaseEntity {
  @Column({ length: 20 })
  reference: string;

  @Column('uuid')
  customerId: string;

  @ManyToOne(() => Customer)
  @JoinColumn({ name: 'customer_id', foreignKeyConstraintName: 'fk_chat__customer_id' })
  customer: Customer;

  /** idempotency key generated on the device (offline create) */
  @Column({ type: 'uuid', nullable: true })
  clientRequestId: string | null;

  @Column({ type: 'uuid', nullable: true })
  assignedStaffId: string | null;

  @ManyToOne(() => Staff, { nullable: true })
  @JoinColumn({ name: 'assigned_staff_id', foreignKeyConstraintName: 'fk_chat__assigned_staff_id' })
  assignedStaff: Staff | null;

  @Column('uuid')
  departmentId: string;

  @ManyToOne(() => Department)
  @JoinColumn({ name: 'department_id', foreignKeyConstraintName: 'fk_chat__department_id' })
  department: Department;

  @Column({ type: 'uuid', nullable: true })
  productId: string | null;

  @ManyToOne(() => Product, { nullable: true })
  @JoinColumn({ name: 'product_id', foreignKeyConstraintName: 'fk_chat__product_id' })
  product: Product | null;

  @Column({ type: 'varchar', length: 20 })
  originChannel: Channel;

  @Column({ type: 'varchar', length: 30 })
  enquiryType: EnquiryType;

  @Column({ type: 'varchar', length: 60, nullable: true })
  enquirySubType: string | null;

  @Column({ length: 200 })
  subject: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', length: 10 })
  priority: Priority;

  @Column({ type: 'varchar', length: 30 })
  status: ChatStatus;

  @Column()
  slaMinutes: number;

  @Column({ type: 'timestamptz' })
  slaDueAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  slaPausedAt: Date | null;

  @Column({ default: 0 })
  slaPausedSeconds: number;

  @Column({ default: false })
  isSlaBreached: boolean;

  @Column({ default: false })
  isNeedsReview: boolean;

  @Column({ default: 0 })
  reopenCount: number;

  @Column({ type: 'timestamptz', nullable: true })
  lastReopenedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  escalatedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  firstResponseAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  @Column({ type: 'timestamptz' })
  lastMessageAt: Date;

  @Column({ type: 'varchar', length: 140, nullable: true })
  lastMessagePreview: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  lastMessageSenderType: SenderType | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  lastMessageChannel: Channel | null;

  @Column({ default: 0 })
  unreadByStaffCount: number;

  @VersionColumn({ default: 1 })
  version: number;
}
