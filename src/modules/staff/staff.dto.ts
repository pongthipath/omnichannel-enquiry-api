import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Department } from './department/department.entity';
import { Staff } from './profile/staff.entity';
import { StaffRole } from './role/staff-role.entity';

// ---------- departments ----------

export class DepartmentDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'QC' }) code: string;
  @ApiProperty({ example: 'ควบคุมคุณภาพ' }) nameTh: string;
  @ApiProperty({ example: 'Quality Control' }) nameEn: string;
  @ApiProperty() isDefault: boolean;
  @ApiProperty() isActive: boolean;
  @ApiProperty() sortOrder: number;
  @ApiPropertyOptional({ description: 'active staff in the department (settings list only)' })
  staffCount?: number;

  static from(d: Department, staffCount?: number): DepartmentDto {
    return {
      id: d.id,
      code: d.code,
      nameTh: d.nameTh,
      nameEn: d.nameEn,
      isDefault: d.isDefault,
      isActive: d.isActive,
      sortOrder: d.sortOrder,
      ...(staffCount === undefined ? {} : { staffCount }),
    };
  }
}

export class CreateDepartmentDto {
  @ApiProperty({ example: 'CLAIMS', description: 'A–Z, 0–9 and _; cannot change later' })
  @Matches(/^[A-Z0-9_]{2,40}$/)
  code: string;

  @ApiProperty({ example: 'เคลมสินค้า' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  nameTh: string;

  @ApiProperty({ example: 'Claims' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  nameEn: string;

  @ApiPropertyOptional({ description: 'receives new enquiries (only one department can)' })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateDepartmentDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) @MaxLength(120) nameTh?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) @MaxLength(120) nameEn?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isDefault?: boolean;
  @ApiPropertyOptional({ description: 'false hides it from pickers; its enquiries stay' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}

// ---------- roles ----------

export class RoleDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'AGENT' }) code: string;
  @ApiProperty({ example: 'Agent' }) name: string;
  @ApiProperty({ example: '3643094387', description: 'permission bitmask as a decimal string' })
  permissions: string;
  @ApiProperty({ description: 'system roles cannot be deleted' }) isSystem: boolean;
  @ApiProperty() staffCount: number;

  static from(r: StaffRole, staffCount: number): RoleDto {
    return {
      id: r.id,
      code: r.code,
      name: r.name,
      permissions: r.permissions.toString(),
      isSystem: r.isSystem,
      staffCount,
    };
  }
}

export class CreateRoleDto {
  @ApiProperty({ example: 'หัวหน้ากะ' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @ApiProperty({ example: '3643094387', description: 'bitmask as a decimal string' })
  @Matches(/^\d{1,19}$/)
  permissions: string;
}

export class UpdateRoleDto extends PartialType(CreateRoleDto) {}

// ---------- staff ----------

export class StaffSummaryDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'สมชาย (QC)' }) name: string;
  @ApiProperty({ format: 'uuid' }) departmentId: string;

  static from(s: Staff): StaffSummaryDto {
    return { id: s.id, name: s.name, departmentId: s.departmentId };
  }
}

export class StaffDetailDto extends StaffSummaryDto {
  @ApiProperty() email: string;
  @ApiProperty({ format: 'uuid' }) roleId: string;
  @ApiProperty({ example: 'Agent' }) roleName: string;
  @ApiProperty({ example: 'ฝ่ายบริการลูกค้า' }) departmentName: string;
  @ApiProperty() isActive: boolean;
  @ApiPropertyOptional({ nullable: true }) lastLoginAt: Date | null;

  static fromFull(s: Staff): StaffDetailDto {
    return {
      ...StaffSummaryDto.from(s),
      email: s.email,
      roleId: s.roleId,
      roleName: s.role?.name ?? '',
      departmentName: s.department?.nameTh ?? '',
      isActive: s.isActive,
      lastLoginAt: s.lastLoginAt,
    };
  }
}

export class CreateStaffDto {
  @ApiProperty({ example: 'new.agent@foodlink.test' })
  @IsEmail()
  @MaxLength(200)
  email: string;

  @ApiProperty({ example: 'ปิยะ (CS)' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @ApiProperty({ format: 'uuid' }) @IsUUID() departmentId: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() roleId: string;

  @ApiProperty({ description: 'first password; the person changes it later', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  password: string;
}

export class UpdateStaffDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) @MaxLength(120) name?: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() departmentId?: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() roleId?: string;
  @ApiPropertyOptional({ description: 'false = cannot sign in; their enquiries stay' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
