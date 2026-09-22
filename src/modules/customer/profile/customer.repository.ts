import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Customer } from './customer.entity';

@Injectable()
export class CustomerRepository {
  constructor(@InjectRepository(Customer) private readonly repo: Repository<Customer>) {}

  findForLogin(email: string): Promise<Customer | null> {
    return this.repo
      .createQueryBuilder('customer')
      .addSelect('customer.passwordHash')
      .where('lower(customer.email) = lower(:email)', { email })
      .getOne();
  }

  findById(id: string): Promise<Customer | null> {
    return this.repo.findOne({ where: { id }, relations: { salesperson: true } });
  }

  findByIds(ids: string[]): Promise<Customer[]> {
    return ids.length ? this.repo.find({ where: { id: In(ids) } }) : Promise.resolve([]);
  }

  /** Trigram search over name/contact/phone/email/code (design §16.10). */
  async searchIds(q: string, limit = 500): Promise<string[]> {
    const rows = await this.repo
      .createQueryBuilder('customer')
      .select('customer.id', 'id')
      .where(
        `(customer.companyName ILIKE :like OR customer.contactName ILIKE :like
          OR customer.phone ILIKE :like OR customer.email ILIKE :like OR customer.code ILIKE :like)`,
        { like: `%${q}%` },
      )
      .limit(limit)
      .getRawMany<{ id: string }>();
    return rows.map((r) => r.id);
  }

  async touch(
    id: string,
    fields: Partial<Pick<Customer, 'lastLoginAt' | 'lastContactAt'>>,
  ): Promise<void> {
    await this.repo.update(id, fields);
  }
}
