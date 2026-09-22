import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Channel } from '../../common/constants/enums';
import { CustomerChannel } from './profile/customer-channel.entity';
import { Customer } from './profile/customer.entity';

export class CustomerChannelDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ enum: Channel }) channel: Channel;
  @ApiPropertyOptional({ nullable: true, example: 'Malee' }) displayName: string | null;

  static from(c: CustomerChannel): CustomerChannelDto {
    return { id: c.id, channel: c.channel, displayName: c.displayName };
  }
}

export class CustomerProfileDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'CUS-00128' }) code: string;
  @ApiProperty({ example: 'Bangkok Bistro Co.' }) companyName: string;
  @ApiPropertyOptional({ example: 'คุณมาลี', nullable: true }) contactName: string | null;
  @ApiPropertyOptional({ example: '0812345678', nullable: true }) phone: string | null;
  @ApiPropertyOptional({ example: 'malee@bkkbistro.test', nullable: true }) email: string | null;
  @ApiPropertyOptional({ nullable: true, format: 'uuid' }) salespersonStaffId: string | null;
  @ApiPropertyOptional({ nullable: true, example: 'ธนพล (Sales)' }) salespersonName: string | null;
  @ApiProperty() isPlaceholder: boolean;
  @ApiProperty({ type: [CustomerChannelDto], description: 'linked external chat identities (staff only)' })
  channels: CustomerChannelDto[];
  @ApiPropertyOptional({ nullable: true, description: 'staff only' }) internalNote: string | null;
  @ApiPropertyOptional({ nullable: true }) lastContactAt: Date | null;
  @ApiProperty() version: number;

  static from(c: Customer, channels: CustomerChannel[] = [], forStaff = false): CustomerProfileDto {
    return {
      id: c.id,
      code: c.code,
      companyName: c.companyName,
      contactName: c.contactName,
      phone: c.phone,
      email: c.email,
      salespersonStaffId: c.salespersonStaffId,
      salespersonName: c.salesperson?.name ?? null,
      isPlaceholder: c.isPlaceholder,
      channels: forStaff ? channels.map(CustomerChannelDto.from) : [],
      internalNote: forStaff ? c.internalNote : null,
      lastContactAt: c.lastContactAt,
      version: c.version,
    };
  }
}

export class CustomerListItemDto extends CustomerProfileDto {
  @ApiProperty({ description: 'enquiries not RESOLVED / CLOSED' }) openEnquiries: number;
}

export class CustomerPageDto {
  @ApiProperty({ type: [CustomerListItemDto] }) items: CustomerListItemDto[];
  @ApiProperty() total: number;
}

export class ListCustomersQuery {
  @ApiPropertyOptional({ description: 'company, contact, phone, email or code contains' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ default: 50, maximum: 200 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(0)
  offset?: number;
}

export class UpdateCustomerDto {
  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  companyName?: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  contactName?: string;

  @ApiPropertyOptional({ maxLength: 30 })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @ValidateIf((_, v) => v !== '')
  @IsEmail()
  @MaxLength(200)
  email?: string;

  @ApiPropertyOptional({ description: 'needs CUSTOMER_PANEL_NOTE_EDIT', maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  internalNote?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'needs CUSTOMER_PANEL_SALESPERSON_ASSIGN',
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  salespersonStaffId?: string | null;

  @ApiPropertyOptional({ description: 'version you saw — mismatch returns 409 customer.changed' })
  @IsOptional()
  @IsInt()
  version?: number;
}
