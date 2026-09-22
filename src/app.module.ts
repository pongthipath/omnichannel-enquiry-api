import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from './common/common.module';
import { envValidationSchema } from './config/env.validation';
import { dataSourceOptions } from './database/data-source';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validationSchema: envValidationSchema }),
    TypeOrmModule.forRoot({ ...dataSourceOptions, autoLoadEntities: true }),
    CommonModule,
    // feature modules (design §3): auth, staff, customer, catalog, chat, webhook, sync, dashboard
  ],
})
export class AppModule {}
