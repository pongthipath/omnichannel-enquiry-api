import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserType } from '../../common/constants/enums';
import { EnquiryService } from '../chat/enquiry/enquiry.service';
import { MessageService } from '../chat/message/message.service';
import { SyncService } from './sync.service';

describe('SyncService', () => {
  const enquiries = { create: jest.fn() } as unknown as EnquiryService;
  const messages = { send: jest.fn() } as unknown as MessageService;
  const service = new SyncService(enquiries, messages);
  const customer = { type: UserType.CUSTOMER as const, id: 'c1' };
  const enquiryPayload = {
    enquiryType: 'COMPLAINT',
    subject: 'กล่องบุบ',
    description: 'เนยกล่องบุบ 2 ลัง',
    priority: 'URGENT',
  };
  const id = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;

  beforeEach(() => jest.clearAllMocks());

  it('ส่ง clientId ไปเป็น clientRequestId และรายงาน created / duplicate ตามผลจริง', async () => {
    (enquiries.create as jest.Mock)
      .mockResolvedValueOnce({ enquiry: { id: 'e1', reference: 'ENQ-2026-000001' }, created: true })
      .mockResolvedValueOnce({
        enquiry: { id: 'e1', reference: 'ENQ-2026-000001' },
        created: false,
      });

    const first = await service.sync(customer, [
      { op: 'conversation.create', clientId: id(1), payload: enquiryPayload },
    ]);
    const again = await service.sync(customer, [
      { op: 'conversation.create', clientId: id(1), payload: enquiryPayload },
    ]);

    expect((enquiries.create as jest.Mock).mock.calls[0][1].clientRequestId).toBe(id(1));
    expect(first[0]).toMatchObject({
      status: 'created',
      serverId: 'e1',
      reference: 'ENQ-2026-000001',
    });
    expect(again[0]).toMatchObject({ status: 'duplicate', serverId: 'e1' });
  });

  it('รายการที่ข้อมูลไม่ถูกต้องล้มเฉพาะตัวนั้น (ไม่ retry) รายการอื่นยังทำต่อ', async () => {
    (enquiries.create as jest.Mock).mockResolvedValue({
      enquiry: { id: 'e2', reference: 'R' },
      created: true,
    });
    const results = await service.sync(customer, [
      { op: 'conversation.create', clientId: id(2), payload: { subject: '' } },
      { op: 'conversation.create', clientId: id(3), payload: enquiryPayload },
    ]);
    expect(results[0]).toMatchObject({
      status: 'failed',
      error: 'common.validation',
      retryable: false,
    });
    expect(results[1]).toMatchObject({ status: 'created', serverId: 'e2' });
  });

  it('ข้อความของเรื่องที่มองไม่เห็นได้ failed แบบไม่ retry · error 5xx ให้ retry ได้', async () => {
    (messages.send as jest.Mock)
      .mockRejectedValueOnce(new NotFoundException('chat.notFound'))
      .mockRejectedValueOnce(new Error('db down'));
    const results = await service.sync(customer, [
      { op: 'message.create', clientId: id(4), payload: { conversationId: 'x', body: 'hi' } },
      { op: 'message.create', clientId: id(5), payload: { conversationId: 'x', body: 'hi' } },
    ]);
    expect(results[0]).toMatchObject({
      status: 'failed',
      error: 'chat.notFound',
      retryable: false,
    });
    expect(results[1]).toMatchObject({
      status: 'failed',
      error: 'common.internal',
      retryable: true,
    });
  });

  it('สิทธิ์ไม่พอ → failed ไม่ retry', async () => {
    (enquiries.create as jest.Mock).mockRejectedValue(new ForbiddenException('auth.forbidden'));
    const [r] = await service.sync(customer, [
      { op: 'conversation.create', clientId: id(6), payload: enquiryPayload },
    ]);
    expect(r).toMatchObject({ status: 'failed', error: 'auth.forbidden', retryable: false });
  });
});
