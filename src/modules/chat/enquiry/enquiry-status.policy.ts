import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Actor, isStaff } from '../../../common/auth/actor';
import { ChatStatus as S, UserType } from '../../../common/constants/enums';
import { Permission } from '../../../common/permissions/permission.enum';

/** SYSTEM = automatic transitions (customer replied, customer message reopens a chat). */
export type StatusActor = Actor | 'SYSTEM';

interface Rule {
  byOwner?: boolean; // assignee (+ INBOX_STATUS_CHANGE) or INBOX_STATUS_CHANGE_ANY
  byCustomer?: boolean;
  bySystem?: boolean;
  byReopenPermission?: boolean; // INBOX_STATUS_REOPEN
}

/**
 * Transition table (design §6.1) — shared shape with the app, which hides buttons that would fail.
 * OPEN → ASSIGNED only happens through assignment (EnquiryService.assign), not a plain status change.
 */
export const TRANSITIONS: Partial<Record<S, Partial<Record<S, Rule>>>> = {
  [S.ASSIGNED]: { [S.IN_PROGRESS]: { byOwner: true } },
  [S.IN_PROGRESS]: {
    [S.WAITING_FOR_CUSTOMER]: { byOwner: true },
    [S.RESOLVED]: { byOwner: true },
  },
  [S.WAITING_FOR_CUSTOMER]: {
    [S.IN_PROGRESS]: { byOwner: true, bySystem: true },
    [S.RESOLVED]: { byOwner: true },
  },
  [S.RESOLVED]: {
    [S.IN_PROGRESS]: { byOwner: true },
    [S.CLOSED]: { byOwner: true, byCustomer: true },
    [S.OPEN]: { bySystem: true, byReopenPermission: true },
  },
  [S.CLOSED]: { [S.OPEN]: { bySystem: true, byReopenPermission: true } },
};

export interface StatusSubject {
  status: S;
  assignedStaffId: string | null;
  customerId: string;
}

/** Throws the API error code that explains why the change is not allowed. */
export function assertCanChangeStatus(chat: StatusSubject, to: S, actor: StatusActor): void {
  const rule = TRANSITIONS[chat.status]?.[to];
  if (!rule) throw new ConflictException('chat.invalidTransition');

  if (actor === 'SYSTEM') {
    if (rule.bySystem) return;
    throw new ConflictException('chat.invalidTransition');
  }

  if (actor.type === UserType.CUSTOMER) {
    if (rule.byCustomer && actor.id === chat.customerId) return;
    throw new ForbiddenException('chat.notResponsible');
  }

  if (rule.byReopenPermission && isStaff(actor) && actor.can(Permission.INBOX_STATUS_REOPEN))
    return;
  if (!rule.byOwner) throw new ForbiddenException('chat.notResponsible');

  // status can change only after the chat has an owner (design §6.1)
  if (!chat.assignedStaffId) throw new ConflictException('chat.notAssigned');
  const isOwner = chat.assignedStaffId === actor.id && actor.can(Permission.INBOX_STATUS_CHANGE);
  if (!isOwner && !actor.can(Permission.INBOX_STATUS_CHANGE_ANY)) {
    throw new ForbiddenException('chat.notResponsible');
  }
}
