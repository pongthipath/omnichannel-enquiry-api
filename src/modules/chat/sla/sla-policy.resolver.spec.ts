import { EnquiryType as T, Priority as P } from '../../../common/constants/enums';
import { addMinutes, resolveSlaMinutes, SlaRule } from './sla-policy.resolver';

const rules: SlaRule[] = [
  { enquiryType: T.COMPLAINT, priority: P.URGENT, targetMinutes: 30 },
  { enquiryType: T.COMPLAINT, priority: null, targetMinutes: 120 },
  { enquiryType: T.PRODUCT_INFORMATION, priority: null, targetMinutes: 240 },
  { enquiryType: null, priority: null, targetMinutes: 1440 },
];

describe('resolveSlaMinutes', () => {
  it('ร้องเรียน + ด่วน ใช้กฎที่เจาะจงที่สุด (30 นาที)', () => {
    expect(resolveSlaMinutes(rules, T.COMPLAINT, P.URGENT)).toBe(30);
  });

  it('ร้องเรียนระดับอื่นใช้กฎของประเภท (2 ชม.)', () => {
    expect(resolveSlaMinutes(rules, T.COMPLAINT, P.NORMAL)).toBe(120);
  });

  it('ประเภทที่ไม่มีกฎใช้ค่าเริ่มต้น (24 ชม.)', () => {
    expect(resolveSlaMinutes(rules, T.GENERAL, P.HIGH)).toBe(1440);
  });

  it('ไม่มีกฎเลยก็ยังได้ 24 ชม. (ไม่ล้ม)', () => {
    expect(resolveSlaMinutes([], T.PRICING, P.LOW)).toBe(1440);
  });

  it('addMinutes บวกเวลาถูกต้อง', () => {
    expect(addMinutes(new Date('2026-09-22T10:00:00Z'), 30).toISOString()).toBe(
      '2026-09-22T10:30:00.000Z',
    );
  });
});
