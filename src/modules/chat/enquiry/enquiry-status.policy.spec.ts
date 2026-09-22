import { ConflictException, ForbiddenException } from '@nestjs/common';
import { StaffActor } from '../../../common/auth/actor';
import { ChatStatus as S, UserType } from '../../../common/constants/enums';
import { Permission as P } from '../../../common/permissions/permission.enum';
import { toMask } from '../../../common/permissions/permission-mask.util';
import { assertCanChangeStatus, StatusSubject } from './enquiry-status.policy';

const staff = (id: string, perms: P[]) => new StaffActor(id, 'dept', 'role', id, toMask(perms));
const owner = staff('owner', [P.INBOX_STATUS_CHANGE]);
const colleague = staff('colleague', [P.INBOX_STATUS_CHANGE]);
const supervisor = staff('sup', [
  P.INBOX_STATUS_CHANGE,
  P.INBOX_STATUS_CHANGE_ANY,
  P.INBOX_STATUS_REOPEN,
]);
const customer = { type: UserType.CUSTOMER as const, id: 'cust' };

const chat = (status: S, assignedStaffId: string | null = 'owner'): StatusSubject => ({
  status,
  assignedStaffId,
  customerId: 'cust',
});

describe('assertCanChangeStatus', () => {
  it('ผู้รับผิดชอบเดินตามลำดับได้: ASSIGNED → IN_PROGRESS → WAITING → RESOLVED', () => {
    expect(() => assertCanChangeStatus(chat(S.ASSIGNED), S.IN_PROGRESS, owner)).not.toThrow();
    expect(() =>
      assertCanChangeStatus(chat(S.IN_PROGRESS), S.WAITING_FOR_CUSTOMER, owner),
    ).not.toThrow();
    expect(() =>
      assertCanChangeStatus(chat(S.WAITING_FOR_CUSTOMER), S.RESOLVED, owner),
    ).not.toThrow();
  });

  it('ข้ามขั้นไม่ได้ (OPEN → RESOLVED, ASSIGNED → CLOSED) → 409 invalidTransition', () => {
    expect(() => assertCanChangeStatus(chat(S.OPEN), S.RESOLVED, supervisor)).toThrow(
      ConflictException,
    );
    expect(() => assertCanChangeStatus(chat(S.ASSIGNED), S.CLOSED, owner)).toThrow(
      ConflictException,
    );
  });

  it('staff ที่ไม่ใช่ผู้รับผิดชอบและไม่มี CHANGE_ANY → 403 notResponsible', () => {
    expect(() => assertCanChangeStatus(chat(S.IN_PROGRESS), S.RESOLVED, colleague)).toThrow(
      ForbiddenException,
    );
  });

  it('หัวหน้าที่มี CHANGE_ANY เปลี่ยนเรื่องของคนอื่นได้', () => {
    expect(() => assertCanChangeStatus(chat(S.IN_PROGRESS), S.RESOLVED, supervisor)).not.toThrow();
  });

  it('เรื่องที่ยังไม่มีผู้รับผิดชอบ เปลี่ยนสถานะไม่ได้แม้เป็นหัวหน้า → 409 notAssigned', () => {
    const unassigned = { ...chat(S.IN_PROGRESS), assignedStaffId: null };
    expect(() => assertCanChangeStatus(unassigned, S.RESOLVED, supervisor)).toThrow(
      new ConflictException('chat.notAssigned'),
    );
  });

  it('ลูกค้าเจ้าของเรื่องยืนยันปิดเรื่องได้เฉพาะจาก RESOLVED', () => {
    expect(() => assertCanChangeStatus(chat(S.RESOLVED), S.CLOSED, customer)).not.toThrow();
    expect(() => assertCanChangeStatus(chat(S.IN_PROGRESS), S.RESOLVED, customer)).toThrow();
    expect(() =>
      assertCanChangeStatus(chat(S.RESOLVED), S.CLOSED, { ...customer, id: 'other' }),
    ).toThrow(ForbiddenException);
  });

  it('ระบบเปิดเรื่องใหม่ได้เมื่อลูกค้าทักมา (RESOLVED/CLOSED → OPEN) และคืน WAITING → IN_PROGRESS', () => {
    expect(() => assertCanChangeStatus(chat(S.CLOSED), S.OPEN, 'SYSTEM')).not.toThrow();
    expect(() => assertCanChangeStatus(chat(S.RESOLVED), S.OPEN, 'SYSTEM')).not.toThrow();
    expect(() =>
      assertCanChangeStatus(chat(S.WAITING_FOR_CUSTOMER), S.IN_PROGRESS, 'SYSTEM'),
    ).not.toThrow();
    expect(() => assertCanChangeStatus(chat(S.IN_PROGRESS), S.RESOLVED, 'SYSTEM')).toThrow(
      ConflictException,
    );
  });

  it('เปิดเรื่องใหม่ด้วยมือต้องมี STATUS_REOPEN', () => {
    expect(() => assertCanChangeStatus(chat(S.CLOSED), S.OPEN, supervisor)).not.toThrow();
    expect(() => assertCanChangeStatus(chat(S.CLOSED), S.OPEN, owner)).toThrow(ForbiddenException);
  });
});
