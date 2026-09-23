import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health/health.controller';
import { ShutdownState } from './health/shutdown.state';
import { RealtimePublisher } from './realtime/realtime.publisher';
import { RedisService } from './redis/redis.service';
import { StorageService } from './storage/storage.service';

/**
 * Shared building blocks used by every module (design §3 `common`).
 * Still to come: rmq, storage (S3), trigram search util.
 */
@Global()
@Module({
  imports: [
    TerminusModule,
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get('JWT_ACCESS_TTL', '15m') },
      }),
    }),
  ],
  controllers: [HealthController],
  providers: [
    { provide: ShutdownState, useFactory: () => new ShutdownState() },
    RedisService,
    RealtimePublisher, StorageService],
  exports: [ShutdownState, RedisService, RealtimePublisher, StorageService],
})
export class CommonModule {}
