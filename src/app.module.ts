import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthGuard } from './common/auth/auth.guard';
import { CommonModule } from './common/common.module';
import { RealtimeGateway } from './common/realtime/realtime.gateway';
import { envValidationSchema } from './config/env.validation';
import { dataSourceOptions } from './database/data-source';
import { AuthModule } from './modules/auth/auth.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { ChatModule } from './modules/chat/chat.module';
import { CustomerModule } from './modules/customer/customer.module';
import { StaffModule } from './modules/staff/staff.module';
import { SyncModule } from './modules/sync/sync.module';
import { WebhookModule } from './modules/webhook/webhook.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validationSchema: envValidationSchema }),
    TypeOrmModule.forRoot({ ...dataSourceOptions, autoLoadEntities: true }),
    CommonModule,
    StaffModule,
    CustomerModule,
    AuthModule,
    CatalogModule,
    ChatModule,
    SyncModule,
    WebhookModule,
  ],
  providers: [
    // guard + gateway live here because they need the staff module's ActorResolver
    AuthGuard,
    { provide: APP_GUARD, useExisting: AuthGuard },
    RealtimeGateway,
  ],
})
export class AppModule {}
