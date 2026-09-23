import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { StaffActor } from '../../../common/auth/actor';
import { CurrentActor, RequirePermission } from '../../../common/auth/auth.decorators';
import { Permission } from '../../../common/permissions/permission.enum';
import { CustomerMessagePageDto, ListCustomerMessagesQuery } from './message.dto';
import { MessageService } from './message.service';

/**
 * The customer's whole conversation, not one enquiry's (design A9/A10). It lives in its own
 * controller because the path hangs off the customer, while the work belongs to the message module.
 */
@ApiTags('Customers')
@ApiBearerAuth()
@Controller('customers/:id/messages')
export class CustomerMessageController {
  constructor(private readonly messages: MessageService) {}

  @Get()
  @RequirePermission(Permission.INBOX_CUSTOMER_CHAT_VIEW)
  @ApiOperation({
    summary: 'Every message of this customer across their enquiries, newest first (q searches the text)',
  })
  @ApiOkResponse({ type: CustomerMessagePageDto })
  list(
    @CurrentActor() actor: StaffActor,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListCustomerMessagesQuery,
  ): Promise<CustomerMessagePageDto> {
    return this.messages.listForCustomer(actor, id, query);
  }
}
