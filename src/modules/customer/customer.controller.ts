import { Controller, ForbiddenException, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Actor, isStaff } from '../../common/auth/actor';
import { CurrentActor } from '../../common/auth/auth.decorators';
import { ApiErrorDto } from '../../common/dto/api-error.dto';
import { Permission } from '../../common/permissions/permission.enum';
import { CustomerProfileDto } from './customer.dto';
import { CustomerService } from './customer.service';

@ApiTags('Customers')
@ApiBearerAuth()
@Controller('customers')
export class CustomerController {
  constructor(private readonly customers: CustomerService) {}

  @Get('me')
  @ApiOperation({ summary: 'Profile of the signed-in customer (app Profile screen)' })
  @ApiOkResponse({ type: CustomerProfileDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  async me(@CurrentActor() actor: Actor): Promise<CustomerProfileDto> {
    if (isStaff(actor)) throw new ForbiddenException('auth.customerOnly');
    return CustomerProfileDto.from(await this.customers.getById(actor.id));
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Customer profile (staff with contact permission, or the customer themself)',
  })
  @ApiOkResponse({ type: CustomerProfileDto })
  async getOne(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CustomerProfileDto> {
    const allowed = isStaff(actor)
      ? actor.can(Permission.CUSTOMER_PANEL_CONTACT_VIEW)
      : actor.id === id;
    if (!allowed) throw new ForbiddenException('auth.forbidden');
    return CustomerProfileDto.from(await this.customers.getById(id));
  }
}
