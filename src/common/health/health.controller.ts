import { Controller, Get, ServiceUnavailableException, VERSION_NEUTRAL } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckResult,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { Public } from '../auth/auth.decorators';
import { ShutdownState } from './shutdown.state';

@Public() // probed by the load balancer without a token
@ApiTags('Health')
@Controller({ path: 'health', version: VERSION_NEUTRAL }) // /api/health/* — load balancer path, not versioned
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly shutdown: ShutdownState,
  ) {}

  @Get('live')
  @ApiOperation({ summary: 'Process is running (container liveness)' })
  @ApiOkResponse({ schema: { example: { status: 'ok' } } })
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('ready')
  @HealthCheck()
  @ApiOperation({
    summary: 'Ready to receive traffic (load balancer health check)',
    description:
      'Returns 503 while shutting down or when a dependency is unreachable. Redis/RabbitMQ checks are added with their modules.',
  })
  @ApiServiceUnavailableResponse({ description: 'Draining or a dependency is down' })
  ready(): Promise<HealthCheckResult> {
    if (this.shutdown.isShuttingDown) throw new ServiceUnavailableException('health.shuttingDown');
    return this.health.check([() => this.db.pingCheck('database', { timeout: 2000 })]);
  }
}
