import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { StaffActor } from '../../../common/auth/actor';
import { UserType } from '../../../common/constants/enums';
import { Permission } from '../../../common/permissions/permission.enum';
import { toMask } from '../../../common/permissions/permission-mask.util';
import { RealtimePublisher } from '../../../common/realtime/realtime.publisher';
import { TagAppliesTo, TagColor } from './tag.entity';
import { TagRepository } from './tag.repository';
import { TagService } from './tag.service';

describe('TagService', () => {
  const repo = {
    findByName: jest.fn(),
    findByIds: jest.fn(),
    save: jest.fn(async (t) => ({ id: 't1', ...t })),
  } as unknown as TagRepository;
  const realtime = { emit: jest.fn() } as unknown as RealtimePublisher;
  const service = new TagService(repo, realtime);
  const staff = (...p: Permission[]) => new StaffActor('s1', 'd1', 'r1', 'สุดา', toMask(p));

  beforeEach(() => jest.clearAllMocks());

  it('สร้างแท็กได้ถ้ามีสิทธิ์จัดการแท็ก หรือสิทธิ์สร้างระหว่างแชท และแจ้งทุกหน้าจอแบบ realtime', async () => {
    (repo.findByName as jest.Mock).mockResolvedValue(null);

    const tag = await service.create(staff(Permission.INBOX_TAG_CREATE_INLINE), { name: '  ขนส่งล่าช้า ' });

    expect(tag).toMatchObject({ name: 'ขนส่งล่าช้า', color: TagColor.BLUE, usageCount: 0 });
    expect(realtime.emit).toHaveBeenCalledWith('tag.changed', ['staff:all'], expect.objectContaining({ action: 'created' }));
  });

  it('ไม่มีสิทธิ์ หรือเป็นลูกค้า สร้างแท็กไม่ได้', async () => {
    await expect(service.create(staff(Permission.INBOX_TAG_APPLY), { name: 'x' })).rejects.toThrow(ForbiddenException);
    await expect(service.create({ type: UserType.CUSTOMER, id: 'c1' }, { name: 'x' })).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('ชื่อซ้ำ (ไม่สนตัวพิมพ์เล็กใหญ่) ได้ 409 tag.duplicateName', async () => {
    (repo.findByName as jest.Mock).mockResolvedValue({ id: 'other', name: 'VIP' });
    await expect(service.create(staff(Permission.SETTINGS_TAG_MANAGE), { name: 'vip' })).rejects.toThrow(
      ConflictException,
    );
  });

  it('ติดแท็กให้เรื่องได้เฉพาะแท็กที่มีอยู่จริงและไม่ใช่แท็กสำหรับลูกค้าอย่างเดียว', async () => {
    (repo.findByIds as jest.Mock).mockResolvedValueOnce([{ id: 'a', appliesTo: TagAppliesTo.ENQUIRY }]);
    await expect(service.assertApplicableToEnquiry(['a', 'missing'])).rejects.toThrow(BadRequestException);

    (repo.findByIds as jest.Mock).mockResolvedValueOnce([{ id: 'b', appliesTo: TagAppliesTo.CUSTOMER }]);
    await expect(service.assertApplicableToEnquiry(['b'])).rejects.toThrow('tag.notForEnquiry');

    (repo.findByIds as jest.Mock).mockResolvedValueOnce([
      { id: 'a', appliesTo: TagAppliesTo.ENQUIRY },
      { id: 'c', appliesTo: TagAppliesTo.BOTH },
    ]);
    await expect(service.assertApplicableToEnquiry(['a', 'c', 'a'])).resolves.toBeUndefined();
  });
});
