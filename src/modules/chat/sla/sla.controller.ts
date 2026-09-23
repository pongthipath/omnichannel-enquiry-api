import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { RequirePermission } from '../../../common/auth/auth.decorators';
import { ApiErrorDto } from '../../../common/dto/api-error.dto';
import { Permission } from '../../../common/permissions/permission.enum';
import { CreateSlaPolicyDto, SlaPolicyDto, UpdateSlaPolicyDto } from './sla.dto';
import { SlaService } from './sla.service';

@ApiTags('SLA policies')
@ApiBearerAuth()
@Controller('sla-policies')
export class SlaController {
  constructor(private readonly sla: SlaService) {}

  @Get()
  @RequirePermission(Permission.SETTINGS_SLA_VIEW)
  @ApiOperation({ summary: 'Reply-time rules; the most specific match wins (type + priority → type → default)' })
  @ApiOkResponse({ type: [SlaPolicyDto] })
  list(): Promise<SlaPolicyDto[]> {
    return this.sla.list();
  }

  @Post()
  @RequirePermission(Permission.SETTINGS_SLA_EDIT)
  @ApiOperation({ summary: 'Add a rule for a type / priority combination' })
  @ApiCreatedResponse({ type: SlaPolicyDto })
  @ApiConflictResponse({ type: ApiErrorDto, description: 'sla.duplicateRule' })
  create(@Body() dto: CreateSlaPolicyDto): Promise<SlaPolicyDto> {
    return this.sla.create(dto);
  }

  @Patch(':id')
  @RequirePermission(Permission.SETTINGS_SLA_EDIT)
  @ApiOperation({ summary: 'Change the target, the pause rule, or switch it off (open enquiries keep their target)' })
  @ApiOkResponse({ type: SlaPolicyDto })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSlaPolicyDto): Promise<SlaPolicyDto> {
    return this.sla.update(id, dto);
  }
}
