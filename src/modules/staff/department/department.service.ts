import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Department } from './department.entity';

@Injectable()
export class DepartmentService {
  constructor(@InjectRepository(Department) private readonly repo: Repository<Department>) {}

  listActive(): Promise<Department[]> {
    return this.repo.find({ where: { isActive: true }, order: { sortOrder: 'ASC' } });
  }

  /** Department that receives new enquiries (exactly one has is_default). */
  async getDefault(): Promise<Department> {
    const dept = await this.repo.findOne({ where: { isDefault: true, isActive: true } });
    if (!dept) throw new InternalServerErrorException('department.noDefault');
    return dept;
  }

  findActiveById(id: string): Promise<Department | null> {
    return this.repo.findOne({ where: { id, isActive: true } });
  }
}
