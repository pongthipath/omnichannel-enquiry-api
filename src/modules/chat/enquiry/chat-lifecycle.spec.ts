import { ChatStatus as S } from '../../../common/constants/enums';
import { applyStatusChange } from './chat-lifecycle';
import { Chat } from './chat.entity';

const base = (status: S): Chat =>
  Object.assign(new Chat(), {
    status,
    slaMinutes: 120,
    slaDueAt: new Date('2026-09-22T12:00:00Z'),
    slaPausedAt: null,
    slaPausedSeconds: 0,
    isSlaBreached: false,
    reopenCount: 0,
    lastReopenedAt: null,
    resolvedAt: null,
  });

describe('applyStatusChange', () => {
  it('WAITING หยุดนับ SLA และกลับมา IN_PROGRESS แล้วเลื่อนกำหนดเสร็จตามเวลาที่หยุด', () => {
    const chat = base(S.IN_PROGRESS);
    applyStatusChange(chat, S.WAITING_FOR_CUSTOMER, new Date('2026-09-22T10:00:00Z'));
    expect(chat.slaPausedAt).toEqual(new Date('2026-09-22T10:00:00Z'));

    applyStatusChange(chat, S.IN_PROGRESS, new Date('2026-09-22T10:30:00Z'));
    expect(chat.slaPausedAt).toBeNull();
    expect(chat.slaPausedSeconds).toBe(1800);
    expect(chat.slaDueAt).toEqual(new Date('2026-09-22T12:30:00Z'));
  });

  it('RESOLVED บันทึกเวลาแก้ไข และ ยกเลิกกลับ IN_PROGRESS ล้างค่า', () => {
    const chat = base(S.IN_PROGRESS);
    applyStatusChange(chat, S.RESOLVED, new Date('2026-09-22T11:00:00Z'));
    expect(chat.resolvedAt).toEqual(new Date('2026-09-22T11:00:00Z'));
    applyStatusChange(chat, S.IN_PROGRESS, new Date('2026-09-22T11:01:00Z'));
    expect(chat.resolvedAt).toBeNull();
  });

  it('เปิดใหม่จาก CLOSED: นับครั้ง เริ่ม SLA รอบใหม่ และล้างสถานะเกิน SLA', () => {
    const chat = { ...base(S.CLOSED), isSlaBreached: true } as Chat;
    const now = new Date('2026-10-01T09:00:00Z');
    applyStatusChange(chat, S.OPEN, now, { slaMinutes: 30 });
    expect(chat.status).toBe(S.OPEN);
    expect(chat.reopenCount).toBe(1);
    expect(chat.lastReopenedAt).toEqual(now);
    expect(chat.isSlaBreached).toBe(false);
    expect(chat.slaDueAt).toEqual(new Date('2026-10-01T09:30:00Z'));
  });
});
