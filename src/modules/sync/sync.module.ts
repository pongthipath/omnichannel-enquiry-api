import { Module } from '@nestjs/common';
import { ChatModule } from '../chat/chat.module';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

@Module({
  imports: [ChatModule],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
