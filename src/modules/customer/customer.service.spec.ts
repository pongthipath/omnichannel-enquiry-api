import { ConflictException, ForbiddenException } from '@nestjs/common';
import { StaffActor } from '../../common/auth/actor';
import { Permission } from '../../common/permissions/permission.enum';
import { toMask } from '../../common/permissions/permission-mask.util';
import { RealtimePublisher } from '../../common/realtime/realtime.publisher';
import { CustomerService } from './customer.service';
import { CustomerRepository } from './profile/customer.repository';

describe('CustomerService.update', () => {
  const stored = () => ({
    id: 'c1',
    code: 'CUS-00128',
    companyName: 'Bangkok Bistro Co.',
    contactName: 'คุณมาลี',
    phone: '0812345678',
    email: 'malee@bkkbistro.test',
    salespersonStaffId: null,
    salesperson: null,
    isPlaceholder: false,
    internalNote: null,
    version: 3,
    lastContactAt: null,
  });
  const repo = {
    findById: jest.fn(async () => stored()),
    channelsFor: jest.fn(async () => new Map()),
    save: jest.fn(async (c) => c),
  } as unknown as CustomerRepository;
  const realtime = { emit: jest.fn() } as unknown as RealtimePublisher;
  const service = new CustomerService(repo, realtime);
  const staff = (...p: Permission[]) => new StaffActor('s1', 'd1', 'r1', 'สุดา', toMask(p));

  beforeEach(() => jest.clearAllMocks());

  it('แก้ข้อมูลติดต่อได้เมื่อมีสิทธิ์ CONTACT_EDIT และตัดช่องว่าง / อีเมลเป็นตัวเล็ก', async () => {
    await service.update(staff(Permission.CUSTOMER_PANEL_CONTACT_EDIT), 'c1', {
      contactName: '  คุณมาลี ใจดี ',
      email: 'Malee@BKKbistro.test',
    });
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ contactName: 'คุณมาลี ใจดี', email: 'malee@bkkbistro.test' }),
    );
  });

  it('แต่ละกลุ่มข้อมูลใช้สิทธิ์ของตัวเอง: โน้ต และเซลส์ผู้ดูแล', async () => {
    const contactOnly = staff(Permission.CUSTOMER_PANEL_CONTACT_EDIT);
    await expect(service.update(contactOnly, 'c1', { internalNote: 'x' })).rejects.toThrow(ForbiddenException);
    await expect(service.update(contactOnly, 'c1', { salespersonStaffId: null })).rejects.toThrow(
      ForbiddenException,
    );
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('version ไม่ตรง (มีคนแก้ก่อน) ได้ 409 customer.changed', async () => {
    await expect(
      service.update(staff(Permission.CUSTOMER_PANEL_CONTACT_EDIT), 'c1', { phone: '0', version: 2 }),
    ).rejects.toThrow(ConflictException);
  });
});
