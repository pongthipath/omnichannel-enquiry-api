import { Body, Controller, Headers, Param, Post, Req, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiExcludeEndpoint,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { Public, RequirePermission } from '../../common/auth/auth.decorators';
import { ApiErrorDto } from '../../common/dto/api-error.dto';
import { Permission } from '../../common/permissions/permission.enum';
import { InboundResultDto, SimulateInboundDto } from './inbound/inbound.dto';
import { InboundService } from './inbound/inbound.service';
import { verifyHmac } from './inbound/signature.util';

type ChannelParam = 'line' | 'facebook' | 'web-chat';

/**
 * Where the outside world writes in (design §8). Public routes — the signature is the authentication,
 * checked over the raw body. The work is the same for every channel: normalise → InboundService.
 */
@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhookController {
  constructor(
    private readonly inbound: InboundService,
    private readonly config: ConfigService,
  ) {}

  @Post('simulate')
  @ApiBearerAuth()
  @RequirePermission(Permission.SIMULATOR_PAGE_USE)
  @ApiOperation({
    summary: 'Channel simulator: feed a message in as if LINE / Facebook / web chat had sent it',
    description: 'Same path as a real webhook, without the signature — for demos and testing (design §8, A5).',
  })
  @ApiCreatedResponse({ type: InboundResultDto })
  simulate(@Body() dto: SimulateInboundDto): Promise<InboundResultDto> {
    return this.inbound.handle([
      {
        channel: dto.channel,
        externalUserId: dto.externalUserId,
        displayName: dto.displayName,
        text: dto.text,
        imageUrl: dto.imageUrl,
        externalMessageId: `sim:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      },
    ]);
  }
  @Post('facebook/verify')
  @Public()
  @ApiExcludeEndpoint()
  verifyFacebookSubscription(@Body() body: { 'hub.challenge'?: string }): string {
    return body['hub.challenge'] ?? '';
  }

  @Post(':channel')
  @Public()
  @ApiOperation({
    summary: 'Channel webhook (line · facebook · web-chat) — verified by signature, replays are ignored',
  })
  @ApiOkResponse({ type: InboundResultDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto, description: 'webhook.badSignature' })
  async receive(
    @Param('channel') channel: ChannelParam,
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('x-line-signature') lineSignature: string | undefined,
    @Headers('x-hub-signature-256') fbSignature: string | undefined,
    @Body() payload: unknown,
  ): Promise<InboundResultDto> {
    if (channel === 'line') {
      const ok = verifyHmac(req.rawBody, lineSignature, this.config.get('LINE_CHANNEL_SECRET'), 'line');
      if (!ok) throw new UnauthorizedException('webhook.badSignature');
      return this.inbound.handle(InboundService.fromLine(payload));
    }
    if (channel === 'facebook') {
      const ok = verifyHmac(req.rawBody, fbSignature, this.config.get('FB_APP_SECRET'), 'facebook');
      if (!ok) throw new UnauthorizedException('webhook.badSignature');
      return this.inbound.handle(InboundService.fromFacebook(payload));
    }
    // our own widget: same origin + its own secret header
    const ok = verifyHmac(req.rawBody, fbSignature, this.config.get('FB_APP_SECRET'), 'facebook');
    if (!ok) throw new UnauthorizedException('webhook.badSignature');
    return this.inbound.handle(InboundService.fromWebChat(payload));
  }
}
