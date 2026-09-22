import { addDecimal, multiplyDecimal, roundDecimal } from './decimal.util';

describe('decimal.util', () => {
  it('บวกเลขทศนิยมโดยไม่มีปัญหา floating point (0.1 + 0.2 = 0.30)', () => {
    expect(addDecimal([0.1, 0.2])).toBe('0.30');
  });

  it('บวกค่าที่เป็น string ได้ และได้ผลรวมเป็นศูนย์เมื่อไม่มีค่า', () => {
    expect(addDecimal(['10.005', '0.004'], 3)).toBe('10.009');
    expect(addDecimal([])).toBe('0.00');
  });

  it('คูณแล้วปัดครึ่งขึ้นตาม scale', () => {
    expect(multiplyDecimal('19.99', 3)).toBe('59.97');
    expect(multiplyDecimal('1.005', 1)).toBe('1.01');
  });

  it('ปัดเศษแบบ ROUND_HALF_UP รวมค่าติดลบ', () => {
    expect(roundDecimal('2.345')).toBe('2.35');
    expect(roundDecimal('-2.345')).toBe('-2.35');
  });
});
