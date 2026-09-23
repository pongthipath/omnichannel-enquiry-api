import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CustomerOrder, OrderStatus } from './customer-order.entity';

export class CustomerOrderDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'SO-58812' }) orderNo: string;
  @ApiProperty() orderedAt: Date;
  @ApiProperty({ enum: OrderStatus }) status: OrderStatus;
  @ApiProperty({ example: '12500.00', description: 'exact money as a string' }) totalAmount: string;
  @ApiProperty({ example: 'THB' }) currency: string;
  @ApiPropertyOptional({ nullable: true, example: 'Mozzarella 2.3kg ×20, เนยจืด 250g ×12' })
  itemsSummary: string | null;
  @ApiPropertyOptional({ nullable: true }) deliveredAt: Date | null;

  static from(o: CustomerOrder): CustomerOrderDto {
    return {
      id: o.id,
      orderNo: o.orderNo,
      orderedAt: o.orderedAt,
      status: o.status,
      totalAmount: o.totalAmount,
      currency: o.currency,
      itemsSummary: o.itemsSummary,
      deliveredAt: o.deliveredAt,
    };
  }
}
