import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

/**
 * Worker mode: same code as the API, no HTTP listener.
 * Will host RabbitMQ consumers (webhook fallback, attachment mirror, outbound) and the SLA job (design §3, §15).
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule);
  app.enableShutdownHooks();
  new Logger('Worker').log('worker started');
}

void bootstrap();
