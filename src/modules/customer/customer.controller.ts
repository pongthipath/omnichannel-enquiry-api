import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Actor, isStaff, StaffActor } from '../../common/auth/actor';
import { CurrentActor, RequirePermission } from '../../common/auth/auth.decorators';
import { ApiErrorDto } from '../../common/dto/api-error.dto';
import { Permission } from '../../common/permissions/permission.enum';
import {
  CustomerPageDto,
  CustomerProfileDto,
  ListCustomersQuery,
  UpdateCustomerDto,
} from './customer.dto';
import { CustomerService } from './customer.service';

@ApiTags('Customers')
@ApiBearerAuth()
@Controller('customers')
export class CustomerController {
  constructor(private readonly customers: CustomerService) {}

  @Get()
  @RequirePermission(Permission.CUSTOMERS_PAGE_VIEW)
  @ApiOperation({ summary: 'Customers page: search, open enquiry count, linked channels' })
  @ApiOkResponse({ type: CustomerPageDto })
  list(@Query() query: ListCustomersQuery): Promise<CustomerPageDto> {
    return this.customers.list(query);
  }

  @Get('me')
  @ApiOperation({ summary: 'Profile of the signed-in customer (app Profile screen)' })
  @ApiOkResponse({ type: CustomerProfileDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  me(@CurrentActor() actor: Actor): Promise<CustomerProfileDto> {
    if (isStaff(actor)) throw new ForbiddenException('auth.customerOnly');
    return this.customers.getProfile(actor.id, false);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Customer profile (staff with contact permission, or the customer themself)',
  })
  @ApiOkResponse({ type: CustomerProfileDto })
  getOne(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CustomerProfileDto> {
    const allowed = isStaff(actor)
      ? actor.can(Permission.CUSTOMER_PANEL_CONTACT_VIEW)
      : actor.id === id;
    if (!allowed) throw new ForbiddenException('auth.forbidden');
    return this.customers.getProfile(id, isStaff(actor));
  }

  @Patch(':id')
  @RequirePermission(Permission.INBOX_PAGE_VIEW)
  @ApiOperation({
    summary:
      'Edit contact (CONTACT_EDIT), internal note (NOTE_EDIT), salesperson (SALESPERSON_ASSIGN)',
  })
  @ApiOkResponse({ type: CustomerProfileDto })
  @ApiConflictResponse({
    type: ApiErrorDto,
    description: 'customer.changed · customer.duplicateEmail',
  })
  update(
    @CurrentActor() actor: StaffActor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerDto,
  ): Promise<CustomerProfileDto> {
    return this.customers.update(actor, id, dto);
  }
}
