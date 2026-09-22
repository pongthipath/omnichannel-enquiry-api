import { Global, Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health/health.controller';
import { ShutdownState } from './health/shutdown.state';

/**
 * Shared building blocks used by every module (design §3 `common`).
 * Next additions: socket gateway (+ Redis adapter), rmq, redis, storage (S3), guards, realtime publisher, trigram search util.
 */
@Global()
@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [{ provide: ShutdownState, useFactory: () => new ShutdownState() }],
  exports: [ShutdownState],
})
export class CommonModule {}
