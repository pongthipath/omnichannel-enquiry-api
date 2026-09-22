import { Repository } from 'typeorm';
import { Permission } from '../../../common/permissions/permission.enum';
import { bit, hasPermission } from '../../../common/permissions/permission-mask.util';
import { RealtimePublisher } from '../../../common/realtime/realtime.publisher';
import { StaffService } from '../profile/staff.service';
import { RoleService } from './role.service';
import { StaffRole } from './staff-role.entity';

describe('RoleService', () => {
  const role = { id: 'r1', code: 'AGENT', name: 'Agent', permissions: 0n, isSystem: true };
  const qb = {
    addSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getRawAndEntities: jest.fn(async () => ({ entities: [role], raw: [{ role_id: 'r1', staff_count: 3 }] })),
  };
  const repo = {
    findOne: jest.fn(async ({ where }: { where: { id?: string } }) => (where.id ? role : null)),
    save: jest.fn(async (r) => ({ id: 'new', ...r })),
    createQueryBuilder: jest.fn(() => qb),
  } as unknown as Repository<StaffRole>;
  const staff = { forgetActorsOfRole: jest.fn() } as unknown as StaffService;
  const realtime = { emit: jest.fn() } as unknown as RealtimePublisher;
  const service = new RoleService(repo, staff, realtime);

  beforeEach(() => jest.clearAllMocks());

  it('บันทึกสิทธิ์ "แก้ไข" แล้วได้สิทธิ์ "ดู" ที่เกี่ยวข้องอัตโนมัติ', async () => {
    const mask = bit(Permission.CUSTOMER_PANEL_NOTE_EDIT) | bit(Permission.INBOX_STATUS_CHANGE_ANY);
    await service.update('r1', { permissions: mask.toString() });

    const saved = (repo.save as jest.Mock).mock.calls[0][0].permissions as bigint;
    expect(hasPermission(saved, Permission.CUSTOMER_PANEL_NOTE_VIEW)).toBe(true);
    expect(hasPermission(saved, Permission.INBOX_STATUS_CHANGE)).toBe(true);
  });

  it('เปลี่ยนสิทธิ์แล้วล้าง cache ของทุกคนในบทบาท ให้มีผลในคำขอถัดไป', async () => {
    await service.update('r1', { name: 'Agent' });
    expect(staff.forgetActorsOfRole).toHaveBeenCalledWith('r1');
    expect(realtime.emit).toHaveBeenCalledWith('role.changed', ['staff:all'], expect.anything());
  });

  it('บทบาทใหม่ได้รหัส CUSTOM_ และไม่ใช่บทบาทระบบ', async () => {
    await service.create({ name: 'Shift lead', permissions: '0' });
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ code: 'CUSTOM_SHIFT_LEAD', isSystem: false }));
  });
});
