import { Injectable, NotFoundException } from '@nestjs/common';
import { Customer } from './profile/customer.entity';
import { CustomerRepository } from './profile/customer.repository';

/** Facade of the customer module — other modules use this, never the repository. */
@Injectable()
export class CustomerService {
  constructor(private readonly customers: CustomerRepository) {}

  findForLogin(email: string): Promise<Customer | null> {
    return this.customers.findForLogin(email);
  }

  async touchLogin(id: string): Promise<void> {
    await this.customers.touch(id, { lastLoginAt: new Date() });
  }

  async touchContact(id: string): Promise<void> {
    await this.customers.touch(id, { lastContactAt: new Date() });
  }

  async getById(id: string): Promise<Customer> {
    const customer = await this.customers.findById(id);
    if (!customer) throw new NotFoundException('customer.notFound');
    return customer;
  }

  /** id → summary map for list screens (one query per page). */
  async findSummaries(ids: string[]): Promise<Map<string, Customer>> {
    const rows = await this.customers.findByIds([...new Set(ids)]);
    return new Map(rows.map((c) => [c.id, c]));
  }

  searchIds(q: string): Promise<string[]> {
    return this.customers.searchIds(q);
  }
}
