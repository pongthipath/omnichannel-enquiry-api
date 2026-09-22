import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { StaffActor } from '../../../common/auth/actor';
import { CurrentActor, RequirePermission } from '../../../common/auth/auth.decorators';
import { Permission } from '../../../common/permissions/permission.enum';
import { DashboardQuery, DashboardSummaryDto } from './dashboard.dto';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('summary')
  @RequirePermission(Permission.DASHBOARD_PAGE_VIEW)
  @ApiOperation({ summary: 'Counts by status / department / channel, team load, urgent list — within my scope' })
  @ApiOkResponse({ type: DashboardSummaryDto })
  summary(@CurrentActor() actor: StaffActor, @Query() query: DashboardQuery): Promise<DashboardSummaryDto> {
    return this.dashboard.summary(actor, query.days);
  }
}
