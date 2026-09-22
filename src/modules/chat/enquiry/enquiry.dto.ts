import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Channel, ChatStatus, EnquiryType, Priority } from '../../../common/constants/enums';
import { TagSummaryDto } from '../tag/tag.dto';
import { ScopeFilter, Visibility } from './chat-access.policy';
import { Chat } from './chat.entity';

export class CreateEnquiryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Idempotency key generated on the device when the user taps "send" (offline-safe)',
  })
  @IsOptional()
  @IsUUID()
  clientRequestId?: string;

  @ApiProperty({ enum: EnquiryType, example: EnquiryType.COMPLAINT })
  @IsEnum(EnquiryType)
  enquiryType: EnquiryType;

  @ApiPropertyOptional({ example: 'DAMAGED_PRODUCT', maxLength: 60 })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  enquirySubType?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiProperty({ example: 'กล่องบุบ 2 ลัง', maxLength: 200 })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  subject: string;

  @ApiProperty({ example: 'เนยฝรั่งเศสกล่องบุบ 2 ลัง เนยข้างในแตก', maxLength: 5000 })
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  description: string;

  @ApiProperty({ enum: Priority, example: Priority.URGENT })
  @IsEnum(Priority)
  priority: Priority;

  @ApiPropertyOptional({ enum: Channel, default: Channel.MOBILE_APP })
  @IsOptional()
  @IsEnum(Channel)
  channel?: Channel;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'staff only: create on behalf of this customer (phone)',
  })
  @IsOptional()
  @IsUUID()
  customerId?: string;
}

export class ListEnquiriesQuery {
  @ApiPropertyOptional({ enum: ['visible', 'mine', 'department', 'all'], default: 'visible' })
  @IsOptional()
  @IsIn(['visible', 'mine', 'department', 'all'])
  scope?: ScopeFilter;

  @ApiPropertyOptional({
    description: 'comma separated, e.g. OPEN,ASSIGNED',
    example: 'OPEN,ASSIGNED',
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',').filter(Boolean) : value))
  @IsEnum(ChatStatus, { each: true })
  status?: ChatStatus[];

  @ApiPropertyOptional({ description: 'reference or subject contains' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  tagId?: string;

  @ApiPropertyOptional({ description: 'opaque cursor from the previous page' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ default: 30, maximum: 100 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class AssignEnquiryDto {
  @ApiProperty({ format: 'uuid', description: 'staff to own the enquiry (yourself = take it)' })
  @IsUUID()
  staffId: string;
}

export class ChangeStatusDto {
  @ApiProperty({ enum: ChatStatus })
  @IsEnum(ChatStatus)
  status: ChatStatus;

  @ApiPropertyOptional({
    description: 'version you saw — a mismatch returns 409 chat.statusChanged',
  })
  @IsOptional()
  @IsInt()
  version?: number;
}

export class EscalateDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  departmentId: string;

  @ApiProperty({ example: 'ต้องตรวจล็อตสินค้า', maxLength: 500 })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason: string;
}

export class UpdateEnquiryDto {
  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  subject?: string;

  @ApiPropertyOptional({ enum: EnquiryType })
  @IsOptional()
  @IsEnum(EnquiryType)
  enquiryType?: EnquiryType;

  @ApiPropertyOptional({ maxLength: 60, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  enquirySubType?: string;

  @ApiPropertyOptional({ enum: Priority, description: 'changing type or priority recalculates the SLA' })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, description: 'null removes the product' })
  @IsOptional()
  @IsUUID()
  productId?: string | null;
}

export class CustomerSummaryDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'Bangkok Bistro Co.' }) companyName: string;
  @ApiPropertyOptional({ nullable: true }) contactName: string | null;
}

/** Names shown with an enquiry, looked up once per page (no N+1). */
export interface EnquiryExtras {
  customer?: CustomerSummaryDto | null;
  tags?: TagSummaryDto[];
  assignedStaffName?: string | null;
  departmentName?: string | null;
}

export class EnquiryDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'ENQ-2026-000123' }) reference: string;
  @ApiProperty({ enum: ChatStatus }) status: ChatStatus;
  @ApiProperty({ enum: EnquiryType }) enquiryType: EnquiryType;
  @ApiPropertyOptional({ nullable: true }) enquirySubType: string | null;
  @ApiProperty() subject: string;
  @ApiProperty() description: string;
  @ApiProperty({ enum: Priority }) priority: Priority;
  @ApiProperty({ enum: Channel }) originChannel: Channel;
  @ApiProperty({ format: 'uuid' }) customerId: string;
  @ApiPropertyOptional({ type: CustomerSummaryDto, nullable: true })
  customer: CustomerSummaryDto | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) productId: string | null;
  @ApiProperty({ format: 'uuid' }) departmentId: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) assignedStaffId: string | null;
  @ApiPropertyOptional({ nullable: true, example: 'สุดา (CS)' }) assignedStaffName: string | null;
  @ApiPropertyOptional({ nullable: true, example: 'ฝ่ายบริการลูกค้า' }) departmentName: string | null;
  @ApiProperty({ type: [TagSummaryDto] }) tags: TagSummaryDto[];
  @ApiProperty() slaMinutes: number;
  @ApiProperty() slaDueAt: Date;
  @ApiPropertyOptional({ nullable: true }) slaPausedAt: Date | null;
  @ApiProperty() isSlaBreached: boolean;
  @ApiProperty() reopenCount: number;
  @ApiPropertyOptional({ nullable: true }) escalatedAt: Date | null;
  @ApiProperty() lastMessageAt: Date;
  @ApiPropertyOptional({ nullable: true }) lastMessagePreview: string | null;
  @ApiProperty() unreadByStaffCount: number;
  @ApiProperty({ enum: ['MINE', 'DEPARTMENT', 'ALL', 'OWN_CUSTOMER'] }) visibility: Visibility;
  @ApiProperty() version: number;
  @ApiProperty() createdAt: Date;

  static from(c: Chat, visibility: Visibility, extras: EnquiryExtras = {}): EnquiryDto {
    return {
      id: c.id,
      reference: c.reference,
      status: c.status,
      enquiryType: c.enquiryType,
      enquirySubType: c.enquirySubType,
      subject: c.subject,
      description: c.description,
      priority: c.priority,
      originChannel: c.originChannel,
      customerId: c.customerId,
      customer: extras.customer ?? null,
      productId: c.productId,
      departmentId: c.departmentId,
      assignedStaffId: c.assignedStaffId,
      assignedStaffName: extras.assignedStaffName ?? null,
      departmentName: extras.departmentName ?? null,
      tags: extras.tags ?? [],
      slaMinutes: c.slaMinutes,
      slaDueAt: c.slaDueAt,
      slaPausedAt: c.slaPausedAt,
      isSlaBreached: c.isSlaBreached,
      reopenCount: c.reopenCount,
      escalatedAt: c.escalatedAt,
      lastMessageAt: c.lastMessageAt,
      lastMessagePreview: c.lastMessagePreview,
      unreadByStaffCount: c.unreadByStaffCount,
      visibility,
      version: c.version,
      createdAt: c.createdAt,
    };
  }
}

export class EnquiryPageDto {
  @ApiProperty({ type: [EnquiryDto] }) items: EnquiryDto[];
  @ApiPropertyOptional({ nullable: true }) nextCursor: string | null;
}

export class CreateEnquiryResultDto {
  @ApiProperty({ type: EnquiryDto }) enquiry: EnquiryDto;
  @ApiProperty({
    description: 'false = this clientRequestId was already processed (idempotent replay)',
  })
  created: boolean;
}
