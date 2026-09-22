import { Brackets, SelectQueryBuilder } from 'typeorm';
import { Actor, isStaff } from '../../../common/auth/actor';
import { Permission } from '../../../common/permissions/permission.enum';
import { Chat } from './chat.entity';

export type Visibility = 'MINE' | 'DEPARTMENT' | 'ALL' | 'OWN_CUSTOMER';
export type ScopeFilter = 'visible' | 'mine' | 'department' | 'all';

/**
 * Who can see which chat (design §16.4). ONE condition combined with OR — never several lists
 * merged together — so a chat that is both "mine" and "my department" is returned once.
 * Every chat query must go through applyScope.
 */
export const ChatAccessPolicy = {
  applyScope(
    qb: SelectQueryBuilder<Chat>,
    alias: string,
    actor: Actor,
    filter: ScopeFilter = 'visible',
  ) {
    if (!isStaff(actor)) {
      return qb.andWhere(`${alias}.customerId = :scopeCustomerId`, { scopeCustomerId: actor.id });
    }

    const canAll = actor.can(Permission.INBOX_SCOPE_ALL);
    const canDept = actor.can(Permission.INBOX_SCOPE_DEPARTMENT);
    const canOwn = actor.can(Permission.INBOX_SCOPE_OWN);
    const params = { scopeStaffId: actor.id, scopeDeptId: actor.departmentId };

    // extra narrowing chosen by the user (chips) — still inside what they may see
    if (filter === 'mine') qb.andWhere(`${alias}.assignedStaffId = :scopeStaffId`, params);
    if (filter === 'department') qb.andWhere(`${alias}.departmentId = :scopeDeptId`, params);

    if (canAll) return qb;
    return qb.andWhere(
      new Brackets((w) => {
        if (canOwn) w.orWhere(`${alias}.assignedStaffId = :scopeStaffId`, params);
        if (canDept) w.orWhere(`${alias}.departmentId = :scopeDeptId`, params);
        w.orWhere('1 = 0'); // no scope bit at all → sees nothing
      }),
    );
  },

  canView(
    actor: Actor,
    chat: Pick<Chat, 'customerId' | 'assignedStaffId' | 'departmentId'>,
  ): boolean {
    if (!isStaff(actor)) return chat.customerId === actor.id;
    if (actor.can(Permission.INBOX_SCOPE_ALL)) return true;
    if (actor.can(Permission.INBOX_SCOPE_OWN) && chat.assignedStaffId === actor.id) return true;
    return actor.can(Permission.INBOX_SCOPE_DEPARTMENT) && chat.departmentId === actor.departmentId;
  },

  /** One label per row, by priority MINE > DEPARTMENT > ALL. */
  visibility(actor: Actor, chat: Pick<Chat, 'assignedStaffId' | 'departmentId'>): Visibility {
    if (!isStaff(actor)) return 'OWN_CUSTOMER';
    if (chat.assignedStaffId === actor.id) return 'MINE';
    if (chat.departmentId === actor.departmentId) return 'DEPARTMENT';
    return 'ALL';
  },
};
