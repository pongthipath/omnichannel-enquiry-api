import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerController } from './customer.controller';
import { CustomerService } from './customer.service';
import { CustomerOrder } from './order/customer-order.entity';
import { CustomerChannel } from './profile/customer-channel.entity';
import { Customer } from './profile/customer.entity';
import { CustomerRepository } from './profile/customer.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Customer, CustomerChannel, CustomerOrder])],
  controllers: [CustomerController],
  providers: [CustomerRepository, CustomerService],
  exports: [CustomerService],
})
export class CustomerModule {}
