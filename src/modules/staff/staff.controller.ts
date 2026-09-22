import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../common/auth/auth.decorators';
import { Permission } from '../../common/permissions/permission.enum';
import { DepartmentService } from './department/department.service';
import { DepartmentDto, StaffSummaryDto } from './staff.dto';
import { StaffService } from './profile/staff.service';

@ApiTags('Staff')
@ApiBearerAuth()
@Controller()
export class StaffController {
  constructor(
    private readonly staff: StaffService,
    private readonly departments: DepartmentService,
  ) {}

  @Get('departments')
  @RequirePermission(Permission.INBOX_PAGE_VIEW)
  @ApiOperation({ summary: 'Active departments (for assign / escalate pickers)' })
  @ApiOkResponse({ type: [DepartmentDto] })
  async listDepartments(): Promise<DepartmentDto[]> {
    return (await this.departments.listActive()).map(DepartmentDto.from);
  }

  @Get('staff')
  @RequirePermission(Permission.INBOX_PAGE_VIEW)
  @ApiOperation({ summary: 'Active staff, optionally filtered by department (assign picker)' })
  @ApiQuery({ name: 'departmentId', required: false })
  @ApiOkResponse({ type: [StaffSummaryDto] })
  async listStaff(@Query('departmentId') departmentId?: string): Promise<StaffSummaryDto[]> {
    return (await this.staff.findActive(departmentId)).map(StaffSummaryDto.from);
  }
}
