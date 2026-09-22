import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerModule } from '../customer/customer.module';
import { StaffModule } from '../staff/staff.module';
import { Chat } from './enquiry/chat.entity';
import { ChatRepository } from './enquiry/chat.repository';
import { EnquiryController } from './enquiry/enquiry.controller';
import { EnquiryService } from './enquiry/enquiry.service';
import { ChatMessage } from './message/chat-message.entity';
import { ChatMessageRepository } from './message/chat-message.repository';
import { MessageController } from './message/message.controller';
import { MessageService } from './message/message.service';
import { SlaPolicy } from './sla/sla-policy.entity';
import { SlaService } from './sla/sla.service';

@Module({
  imports: [TypeOrmModule.forFeature([Chat, ChatMessage, SlaPolicy]), StaffModule, CustomerModule],
  controllers: [EnquiryController, MessageController],
  providers: [ChatRepository, ChatMessageRepository, SlaService, EnquiryService, MessageService],
  exports: [EnquiryService, MessageService], // facade for sync / webhook modules
})
export class ChatModule {}
