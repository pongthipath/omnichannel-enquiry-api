import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { StaffActor } from '../../common/auth/actor';
import { CurrentActor, RequirePermission } from '../../common/auth/auth.decorators';
import { ApiErrorDto } from '../../common/dto/api-error.dto';
import { Permission } from '../../common/permissions/permission.enum';
import { DepartmentService } from './department/department.service';
import { StaffService } from './profile/staff.service';
import { RoleService } from './role/role.service';
import {
  CreateDepartmentDto,
  CreateRoleDto,
  CreateStaffDto,
  DepartmentDto,
  RoleDto,
  StaffDetailDto,
  StaffSummaryDto,
  UpdateDepartmentDto,
  UpdateRoleDto,
  UpdateStaffDto,
} from './staff.dto';

@ApiTags('Staff, departments, roles')
@ApiBearerAuth()
@Controller()
export class StaffController {
  constructor(
    private readonly staff: StaffService,
    private readonly departments: DepartmentService,
    private readonly roles: RoleService,
  ) {}

  // ---------- departments ----------

  @Get('departments')
  @RequirePermission(Permission.INBOX_PAGE_VIEW)
  @ApiOperation({ summary: 'Active departments (for assign / escalate pickers)' })
  @ApiOkResponse({ type: [DepartmentDto] })
  async listDepartments(): Promise<DepartmentDto[]> {
    return (await this.departments.listActive()).map((d) => DepartmentDto.from(d));
  }

  @Get('settings/departments')
  @RequirePermission(Permission.SETTINGS_DEPARTMENT_MANAGE)
  @ApiOperation({ summary: 'All departments incl. inactive, with staff counts' })
  @ApiOkResponse({ type: [DepartmentDto] })
  listDepartmentsForSettings(): Promise<DepartmentDto[]> {
    return this.departments.listForSettings();
  }

  @Post('departments')
  @RequirePermission(Permission.SETTINGS_DEPARTMENT_MANAGE)
  @ApiOperation({ summary: 'Add a department' })
  @ApiCreatedResponse({ type: DepartmentDto })
  @ApiConflictResponse({ type: ApiErrorDto, description: 'department.duplicateCode' })
  createDepartment(@Body() dto: CreateDepartmentDto): Promise<DepartmentDto> {
    return this.departments.create(dto);
  }

  @Patch('departments/:id')
  @RequirePermission(Permission.SETTINGS_DEPARTMENT_MANAGE)
  @ApiOperation({ summary: 'Rename, set as default, deactivate, reorder' })
  @ApiOkResponse({ type: DepartmentDto })
  @ApiConflictResponse({ type: ApiErrorDto, description: 'department.defaultRequired' })
  updateDepartment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDepartmentDto,
  ): Promise<DepartmentDto> {
    return this.departments.update(id, dto);
  }

  // ---------- roles ----------

  @Get('roles')
  @RequirePermission(Permission.INBOX_PAGE_VIEW)
  @ApiOperation({ summary: 'Roles with their permission bitmask and number of staff' })
  @ApiOkResponse({ type: [RoleDto] })
  listRoles(): Promise<RoleDto[]> {
    return this.roles.list();
  }

  @Post('roles')
  @RequirePermission(Permission.SETTINGS_ROLE_MANAGE)
  @ApiOperation({ summary: 'Create a custom role' })
  @ApiCreatedResponse({ type: RoleDto })
  createRole(@Body() dto: CreateRoleDto): Promise<RoleDto> {
    return this.roles.create(dto);
  }

  @Patch('roles/:id')
  @RequirePermission(Permission.SETTINGS_ROLE_MANAGE)
  @ApiOperation({ summary: 'Rename or change permissions (edit ⇒ view added automatically)' })
  @ApiOkResponse({ type: RoleDto })
  updateRole(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRoleDto): Promise<RoleDto> {
    return this.roles.update(id, dto);
  }

  // ---------- staff ----------

  @Get('staff')
  @RequirePermission(Permission.INBOX_PAGE_VIEW)
  @ApiOperation({ summary: 'Active staff, optionally filtered by department (assign picker)' })
  @ApiQuery({ name: 'departmentId', required: false })
  @ApiOkResponse({ type: [StaffSummaryDto] })
  async listStaff(@Query('departmentId') departmentId?: string): Promise<StaffSummaryDto[]> {
    return (await this.staff.findActive(departmentId)).map(StaffSummaryDto.from);
  }

  @Get('settings/staff')
  @RequirePermission(Permission.SETTINGS_STAFF_MANAGE)
  @ApiOperation({ summary: 'All staff incl. inactive, with role and department' })
  @ApiOkResponse({ type: [StaffDetailDto] })
  listStaffForSettings(): Promise<StaffDetailDto[]> {
    return this.staff.listForSettings();
  }

  @Post('staff')
  @RequirePermission(Permission.SETTINGS_STAFF_MANAGE)
  @ApiOperation({ summary: 'Add a staff account' })
  @ApiCreatedResponse({ type: StaffDetailDto })
  @ApiConflictResponse({ type: ApiErrorDto, description: 'staff.duplicateEmail' })
  createStaff(@Body() dto: CreateStaffDto): Promise<StaffDetailDto> {
    return this.staff.create(dto);
  }

  @Patch('staff/:id')
  @RequirePermission(Permission.SETTINGS_STAFF_MANAGE)
  @ApiOperation({ summary: 'Change name, department, role, or deactivate' })
  @ApiOkResponse({ type: StaffDetailDto })
  @ApiConflictResponse({ type: ApiErrorDto, description: 'staff.cannotDisableSelf' })
  updateStaff(
    @CurrentActor() actor: StaffActor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStaffDto,
  ): Promise<StaffDetailDto> {
    return this.staff.update(actor.id, id, dto);
  }
}
