import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ACTOR_RESOLVER } from '../../common/auth/actor-resolver';
import { Department } from './department/department.entity';
import { DepartmentService } from './department/department.service';
import { Staff } from './profile/staff.entity';
import { StaffService } from './profile/staff.service';
import { RoleService } from './role/role.service';
import { StaffRole } from './role/staff-role.entity';
import { StaffController } from './staff.controller';

/** Sub-modules: profile (staff), department, role. */
@Module({
  imports: [TypeOrmModule.forFeature([Staff, StaffRole, Department])],
  controllers: [StaffController],
  providers: [
    StaffService,
    DepartmentService,
    RoleService,
    { provide: ACTOR_RESOLVER, useExisting: StaffService },
  ],
  exports: [StaffService, DepartmentService, ACTOR_RESOLVER],
})
export class StaffModule {}
