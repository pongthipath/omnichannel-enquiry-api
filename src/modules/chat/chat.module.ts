import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerModule } from '../customer/customer.module';
import { AttachmentController } from './attachment/attachment.controller';
import { AttachmentRepository } from './attachment/attachment.repository';
import { AttachmentService } from './attachment/attachment.service';
import { ChatMessageAttachment } from './attachment/chat-message-attachment.entity';
import { StaffModule } from '../staff/staff.module';
import { DashboardController } from './dashboard/dashboard.controller';
import { DashboardService } from './dashboard/dashboard.service';
import { Chat } from './enquiry/chat.entity';
import { ChatRepository } from './enquiry/chat.repository';
import { EnquiryController } from './enquiry/enquiry.controller';
import { EnquiryService } from './enquiry/enquiry.service';
import { ChatMessage } from './message/chat-message.entity';
import { ChatMessageRepository } from './message/chat-message.repository';
import { CustomerMessageController } from './message/customer-message.controller';
import { MessageController } from './message/message.controller';
import { MessageService } from './message/message.service';
import { SlaPolicy } from './sla/sla-policy.entity';
import { SlaController } from './sla/sla.controller';
import { SlaService } from './sla/sla.service';
import { ChatTag } from './tag/chat-tag.entity';
import { TagController } from './tag/tag.controller';
import { Tag } from './tag/tag.entity';
import { TagRepository } from './tag/tag.repository';
import { TagService } from './tag/tag.service';

/** Sub-modules: enquiry, message, sla, tag, dashboard (design §16.1). */
@Module({
  imports: [
    TypeOrmModule.forFeature([Chat, ChatMessage, SlaPolicy, Tag, ChatTag, ChatMessageAttachment]),
    StaffModule,
    CustomerModule,
  ],
  controllers: [EnquiryController, MessageController, CustomerMessageController, TagController, DashboardController, AttachmentController, SlaController],
  providers: [
    ChatRepository,
    ChatMessageRepository,
    SlaService,
    EnquiryService,
    MessageService,
    TagRepository,
    TagService,
    DashboardService,
    AttachmentRepository,
    AttachmentService,
  ],
  exports: [EnquiryService, MessageService, AttachmentService, SlaService, ChatRepository], // facade for sync / webhook modules
})
export class ChatModule {}
