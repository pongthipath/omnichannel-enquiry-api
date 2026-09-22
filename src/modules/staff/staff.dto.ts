import { ApiProperty } from '@nestjs/swagger';
import { Department } from './department/department.entity';
import { Staff } from './profile/staff.entity';

export class DepartmentDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'QC' }) code: string;
  @ApiProperty({ example: 'ควบคุมคุณภาพ' }) nameTh: string;
  @ApiProperty({ example: 'Quality Control' }) nameEn: string;
  @ApiProperty() isDefault: boolean;

  static from(d: Department): DepartmentDto {
    return { id: d.id, code: d.code, nameTh: d.nameTh, nameEn: d.nameEn, isDefault: d.isDefault };
  }
}

export class StaffSummaryDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'สมชาย (QC)' }) name: string;
  @ApiProperty({ format: 'uuid' }) departmentId: string;

  static from(s: Staff): StaffSummaryDto {
    return { id: s.id, name: s.name, departmentId: s.departmentId };
  }
}
