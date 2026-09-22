import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Actor } from '../../../common/auth/actor';
import { CurrentActor, RequirePermission } from '../../../common/auth/auth.decorators';
import { ApiErrorDto } from '../../../common/dto/api-error.dto';
import { Permission } from '../../../common/permissions/permission.enum';
import { CreateTagDto, TagDto, UpdateTagDto } from './tag.dto';
import { TagService } from './tag.service';

@ApiTags('Tags')
@ApiBearerAuth()
@Controller('tags')
export class TagController {
  constructor(private readonly tags: TagService) {}

  @Get()
  @RequirePermission(Permission.INBOX_PAGE_VIEW)
  @ApiOperation({ summary: 'All tags with how many enquiries use each (pickers + settings page)' })
  @ApiOkResponse({ type: [TagDto] })
  list(): Promise<TagDto[]> {
    return this.tags.list();
  }

  @Post()
  @ApiOperation({ summary: 'Create a tag (SETTINGS_TAG_MANAGE, or INBOX_TAG_CREATE_INLINE from the chat)' })
  @ApiCreatedResponse({ type: TagDto })
  @ApiConflictResponse({ type: ApiErrorDto, description: 'tag.duplicateName' })
  create(@CurrentActor() actor: Actor, @Body() dto: CreateTagDto): Promise<TagDto> {
    return this.tags.create(actor, dto);
  }

  @Patch(':id')
  @RequirePermission(Permission.SETTINGS_TAG_MANAGE)
  @ApiOperation({ summary: 'Rename / recolor / change where the tag applies' })
  @ApiOkResponse({ type: TagDto })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTagDto): Promise<TagDto> {
    return this.tags.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission(Permission.SETTINGS_TAG_MANAGE)
  @ApiOperation({ summary: 'Delete the tag (also removed from every enquiry)' })
  @ApiNoContentResponse()
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.tags.remove(id);
  }
}
