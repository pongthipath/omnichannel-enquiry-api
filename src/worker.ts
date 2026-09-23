import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AttachmentService } from './modules/chat/attachment/attachment.service';
import { SlaService } from './modules/chat/sla/sla.service';

/**
 * Worker mode: same code as the API, no HTTP listener (design §3, §15).
 * Jobs:
 * - mirror attachments that still live on a channel's server into our bucket (design §9)
 * - flag enquiries whose SLA target passed, and push that to the open screens (design §11)
 * Several replicas may run: both jobs are safe to repeat (each row is claimed by its own UPDATE).
 */
const MIRROR_EVERY_MS = 15_000;
const SLA_EVERY_MS = 60_000;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule);
  app.enableShutdownHooks();
  const logger = new Logger('Worker');
  const attachments = app.get(AttachmentService);
  const sla = app.get(SlaService);

  const every = (ms: number, name: string, job: () => Promise<number | string>) => {
    let running = false;
    const timer = setInterval(async () => {
      if (running) return; // never overlap a slow run with the next tick
      running = true;
      try {
        const result = await job();
        if (result) logger.log(`${name}: ${result}`);
      } catch (e) {
        logger.error(`${name} failed: ${(e as Error).message}`);
      } finally {
        running = false;
      }
    }, ms);
    timer.unref?.();
    return timer;
  };

  every(MIRROR_EVERY_MS, 'attachment mirror', async () => {
    const { mirrored, failed } = await attachments.mirrorPending();
    return mirrored || failed ? `${mirrored} mirrored, ${failed} gave up` : '';
  });
  every(SLA_EVERY_MS, 'sla breach', async () => {
    const n = await sla.markBreached();
    return n ? `${n} enquiries passed their target` : '';
  });

  logger.log('worker started — attachment mirror every 15s, SLA check every 60s');
}

void bootstrap();
