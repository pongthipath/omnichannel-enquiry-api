import { Module } from '@nestjs/common';
import { ChatModule } from '../chat/chat.module';
import { CustomerModule } from '../customer/customer.module';
import { InboundService } from './inbound/inbound.service';
import { WebhookController } from './webhook.controller';

/** Sub-modules: inbound (line · facebook · web-chat) + the simulator that shares the same path. */
@Module({
  imports: [ChatModule, CustomerModule],
  controllers: [WebhookController],
  providers: [InboundService],
})
export class WebhookModule {}
