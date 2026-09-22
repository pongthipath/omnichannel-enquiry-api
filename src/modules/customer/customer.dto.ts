import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Customer } from './profile/customer.entity';

export class CustomerProfileDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'CUS-00128' }) code: string;
  @ApiProperty({ example: 'Bangkok Bistro Co.' }) companyName: string;
  @ApiPropertyOptional({ example: 'คุณมาลี', nullable: true }) contactName: string | null;
  @ApiPropertyOptional({ example: '0812345678', nullable: true }) phone: string | null;
  @ApiPropertyOptional({ example: 'malee@bkkbistro.test', nullable: true }) email: string | null;
  @ApiPropertyOptional({ nullable: true, example: 'ธนพล (Sales)' }) salespersonName: string | null;
  @ApiProperty() isPlaceholder: boolean;

  static from(c: Customer): CustomerProfileDto {
    return {
      id: c.id,
      code: c.code,
      companyName: c.companyName,
      contactName: c.contactName,
      phone: c.phone,
      email: c.email,
      salespersonName: c.salesperson?.name ?? null,
      isPlaceholder: c.isPlaceholder,
    };
  }
}
