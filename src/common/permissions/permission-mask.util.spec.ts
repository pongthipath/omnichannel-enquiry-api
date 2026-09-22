import { Permission } from './permission.enum';
import {
  fromMask,
  hasPermission,
  MAX_PERMISSION_BIT,
  normalizeMask,
  toMask,
} from './permission-mask.util';

describe('permission-mask.util', () => {
  it('toMask/hasPermission: เปิดเฉพาะ bit ที่เลือก', () => {
    const mask = toMask([Permission.INBOX_PAGE_VIEW, Permission.INBOX_SCOPE_OWN]);
    expect(mask).toBe(0b110000n);
    expect(hasPermission(mask, Permission.INBOX_SCOPE_OWN)).toBe(true);
    expect(hasPermission(mask, Permission.INBOX_SCOPE_ALL)).toBe(false);
  });

  it('fromMask คืนรายการสิทธิ์เดิม (รวม bit สูงกว่า 32)', () => {
    const list = [Permission.INBOX_CHAT_REPLY, Permission.INBOX_STATUS_CHANGE_ANY];
    expect(fromMask(toMask(list))).toEqual(list);
  });

  it('mask ส่งเป็น string แล้วแปลงกลับได้ค่าเดิม (JSON ไม่แม่นเกิน 2^53)', () => {
    const mask = toMask([Permission.INBOX_STATUS_CHANGE_ANY, Permission.DASHBOARD_PAGE_VIEW]);
    expect(BigInt(mask.toString())).toBe(mask);
  });

  it('normalizeMask เติมสิทธิ์ที่พ่วงกัน (แก้ ⇒ ดู) รวมถึงหลายชั้น', () => {
    const mask = normalizeMask(
      toMask([Permission.CUSTOMER_PANEL_CONTACT_EDIT, Permission.INBOX_STATUS_CHANGE_ANY]),
    );
    expect(hasPermission(mask, Permission.CUSTOMER_PANEL_CONTACT_VIEW)).toBe(true);
    expect(hasPermission(mask, Permission.INBOX_STATUS_CHANGE)).toBe(true);
  });

  it('enum: ไม่มี bit ซ้ำ และไม่เกิน bit 62', () => {
    const bits = Object.values(Permission).filter((v) => typeof v === 'number') as number[];
    expect(new Set(bits).size).toBe(bits.length);
    expect(Math.max(...bits)).toBeLessThanOrEqual(MAX_PERMISSION_BIT);
  });
});
