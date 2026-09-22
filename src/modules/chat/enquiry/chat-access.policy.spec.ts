import { StaffActor } from '../../../common/auth/actor';
import { UserType } from '../../../common/constants/enums';
import { Permission as P } from '../../../common/permissions/permission.enum';
import { toMask } from '../../../common/permissions/permission-mask.util';
import { ChatAccessPolicy } from './chat-access.policy';

const agentQc = new StaffActor(
  's-qc',
  'QC',
  'r',
  'Somchai',
  toMask([P.INBOX_SCOPE_OWN, P.INBOX_SCOPE_DEPARTMENT]),
);
const manager = new StaffActor('s-mgr', 'CS', 'r', 'Wipa', toMask([P.INBOX_SCOPE_ALL]));
const noScope = new StaffActor('s-x', 'CS', 'r', 'X', toMask([P.INBOX_PAGE_VIEW]));
const customer = { type: UserType.CUSTOMER as const, id: 'c1' };

const chat = (assignedStaffId: string | null, departmentId: string, customerId = 'c1') => ({
  assignedStaffId,
  departmentId,
  customerId,
});

describe('ChatAccessPolicy.canView', () => {
  it('agent QC เห็นเรื่องที่ตัวเองรับ (แม้อยู่แผนกอื่น) และเรื่องทั้งหมดของแผนก QC', () => {
    expect(ChatAccessPolicy.canView(agentQc, chat('s-qc', 'SALES'))).toBe(true);
    expect(ChatAccessPolicy.canView(agentQc, chat(null, 'QC'))).toBe(true);
  });

  it('agent QC ไม่เห็นเรื่องแผนก Sales ที่ไม่ใช่ของตัวเอง', () => {
    expect(ChatAccessPolicy.canView(agentQc, chat('someone', 'SALES'))).toBe(false);
  });

  it('manager ที่มี SCOPE_ALL เห็นทุกเรื่อง · staff ที่ไม่มี scope เลยไม่เห็นอะไร', () => {
    expect(ChatAccessPolicy.canView(manager, chat('someone', 'SALES'))).toBe(true);
    expect(ChatAccessPolicy.canView(noScope, chat('s-x', 'CS'))).toBe(false);
  });

  it('ลูกค้าเห็นเฉพาะเรื่องของตัวเอง', () => {
    expect(ChatAccessPolicy.canView(customer, chat(null, 'CS', 'c1'))).toBe(true);
    expect(ChatAccessPolicy.canView(customer, chat(null, 'CS', 'c2'))).toBe(false);
  });
});

describe('ChatAccessPolicy.visibility', () => {
  it('เรื่องที่เป็นทั้งของฉันและอยู่แผนกฉัน ได้ป้ายเดียวคือ MINE', () => {
    expect(ChatAccessPolicy.visibility(agentQc, chat('s-qc', 'QC'))).toBe('MINE');
    expect(ChatAccessPolicy.visibility(agentQc, chat(null, 'QC'))).toBe('DEPARTMENT');
    expect(ChatAccessPolicy.visibility(manager, chat('x', 'SALES'))).toBe('ALL');
  });
});
