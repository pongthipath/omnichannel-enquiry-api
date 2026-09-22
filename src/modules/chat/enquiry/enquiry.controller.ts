import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { Actor } from '../../../common/auth/actor';
import { CurrentActor, RequirePermission } from '../../../common/auth/auth.decorators';
import { ApiErrorDto } from '../../../common/dto/api-error.dto';
import { Permission } from '../../../common/permissions/permission.enum';
import {
  AssignEnquiryDto,
  ChangeStatusDto,
  CreateEnquiryDto,
  CreateEnquiryResultDto,
  EnquiryDto,
  EnquiryPageDto,
  EscalateDto,
  ListEnquiriesQuery,
  UpdateEnquiryDto,
} from './enquiry.dto';
import { SetChatTagsDto } from '../tag/tag.dto';
import { EnquiryService } from './enquiry.service';

/** Path is /conversations as required by the brief; internally a conversation is a `chat` (1 chat = 1 enquiry). */
@ApiTags('Conversations (enquiries)')
@ApiBearerAuth()
@Controller('conversations')
export class EnquiryController {
  constructor(private readonly enquiries: EnquiryService) {}

  @Post()
  @ApiOperation({
    summary: 'Create an enquiry (idempotent with clientRequestId)',
    description:
      '201 when created, 200 with created=false when the same clientRequestId was already processed.',
  })
  @ApiCreatedResponse({ type: CreateEnquiryResultDto })
  @ApiOkResponse({ type: CreateEnquiryResultDto, description: 'idempotent replay' })
  async create(
    @CurrentActor() actor: Actor,
    @Body() dto: CreateEnquiryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<CreateEnquiryResultDto> {
    const result = await this.enquiries.create(actor, dto);
    res.status(result.created ? 201 : 200);
    return result;
  }

  @Get()
  @ApiOperation({
    summary: 'List enquiries visible to me (customer: own · staff: by scope permissions)',
  })
  @ApiOkResponse({ type: EnquiryPageDto })
  list(@CurrentActor() actor: Actor, @Query() query: ListEnquiriesQuery): Promise<EnquiryPageDto> {
    return this.enquiries.list(actor, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Enquiry detail' })
  @ApiOkResponse({ type: EnquiryDto })
  @ApiNotFoundResponse({ type: ApiErrorDto, description: 'chat.notFound (also when out of scope)' })
  get(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string): Promise<EnquiryDto> {
    return this.enquiries.get(actor, id);
  }

  @Put(':id/assign')
  @RequirePermission(Permission.INBOX_PAGE_VIEW)
  @ApiOperation({
    summary: 'Take (yourself) or assign the enquiry — OPEN → ASSIGNED, or change owner',
  })
  @ApiOkResponse({ type: EnquiryDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  @ApiConflictResponse({ type: ApiErrorDto, description: 'chat.invalidTransition' })
  assign(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignEnquiryDto,
  ): Promise<EnquiryDto> {
    return this.enquiries.assign(actor, id, dto.staffId);
  }

  @Put(':id/status')
  @ApiOperation({
    summary:
      'Change status (owner, INBOX_STATUS_CHANGE_ANY, or the customer confirming RESOLVED → CLOSED)',
    description:
      'OPEN → ASSIGNED → IN_PROGRESS → WAITING_FOR_CUSTOMER → RESOLVED → CLOSED. See design §6.1.',
  })
  @ApiOkResponse({ type: EnquiryDto })
  @ApiForbiddenResponse({ type: ApiErrorDto, description: 'chat.notResponsible' })
  @ApiConflictResponse({
    type: ApiErrorDto,
    description: 'chat.notAssigned · chat.invalidTransition · chat.statusChanged',
  })
  changeStatus(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeStatusDto,
  ): Promise<EnquiryDto> {
    return this.enquiries.changeStatus(actor, id, dto.status, dto.version);
  }

  @Patch(':id')
  @RequirePermission(Permission.INBOX_ENQUIRY_EDIT)
  @ApiOperation({ summary: 'Edit details: subject, type, sub type, priority, product (SLA re-snapshot)' })
  @ApiOkResponse({ type: EnquiryDto })
  update(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEnquiryDto,
  ): Promise<EnquiryDto> {
    return this.enquiries.update(actor, id, dto);
  }

  @Put(':id/tags')
  @RequirePermission(Permission.INBOX_TAG_APPLY)
  @ApiOperation({ summary: 'Replace the enquiry tags with this set' })
  @ApiOkResponse({ type: EnquiryDto })
  setTags(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetChatTagsDto,
  ): Promise<EnquiryDto> {
    return this.enquiries.setTags(actor, id, dto.tagIds);
  }

  @Put(':id/escalate')
  @RequirePermission(Permission.INBOX_STATUS_ESCALATE)
  @ApiOperation({ summary: 'Send to another department (back to OPEN in that queue)' })
  @ApiOkResponse({ type: EnquiryDto })
  escalate(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EscalateDto,
  ): Promise<EnquiryDto> {
    return this.enquiries.escalate(actor, id, dto.departmentId, dto.reason);
  }
}
