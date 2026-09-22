import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Actor } from '../../common/auth/actor';
import { CurrentActor } from '../../common/auth/auth.decorators';
import { SyncRequestDto, SyncResponseDto } from './sync.dto';
import { SyncService } from './sync.service';

@ApiTags('Sync (offline outbox)')
@ApiBearerAuth()
@Controller('messages/sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Upload queued offline actions (≤ 50) — safe to repeat',
    description:
      'Each item is idempotent by clientId. Result per item: created · duplicate (already stored — use serverId) · failed (retryable=false → show to user).',
  })
  @ApiOkResponse({ type: SyncResponseDto })
  async sync(@CurrentActor() actor: Actor, @Body() dto: SyncRequestDto): Promise<SyncResponseDto> {
    return { results: await this.syncService.sync(actor, dto.items) };
  }
}
