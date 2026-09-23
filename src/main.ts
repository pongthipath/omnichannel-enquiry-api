import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { RedisIoAdapter } from './common/realtime/redis-io.adapter';
import { seedDevData } from './database/seeds/dev-seed';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true }); // raw body: webhook signatures

  app.set('trust proxy', Number(process.env.TRUST_PROXY ?? 0)); // real client IP behind the load balancer
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.enableCors({ origin: process.env.WEB_ORIGIN?.split(','), credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();

  // Socket.IO across instances via Redis (design §15)
  const ioAdapter = new RedisIoAdapter(app, process.env.REDIS_URL ?? 'redis://localhost:6379');
  ioAdapter.connect();
  app.useWebSocketAdapter(ioAdapter);

  // Swagger is a map of the whole API — useful everywhere except in front of the public internet
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Omnichannel Enquiry API')
      .setDescription('Bearer JWT auth · every error uses ApiErrorDto (`code` = i18n key)')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config), {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  // development: make sure the demo data is there, so a fresh checkout has something to look at
  await seedDevData(app, new Logger('DevSeed'));

  await app.listen(Number(process.env.PORT ?? 4000));
}

void bootstrap();
