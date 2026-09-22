import { UserType } from '../constants/enums';
import { Permission } from '../permissions/permission.enum';
import { hasPermission } from '../permissions/permission-mask.util';

/** Who is making the request. Built once per request by JwtAuthGuard. */
export type Actor = CustomerActor | StaffActor;

export interface CustomerActor {
  type: UserType.CUSTOMER;
  id: string; // customer.id
}

export class StaffActor {
  readonly type = UserType.STAFF as const;

  constructor(
    readonly id: string,
    readonly departmentId: string,
    readonly roleId: string,
    readonly name: string,
    readonly mask: bigint,
  ) {}

  can(p: Permission): boolean {
    return hasPermission(this.mask, p);
  }
}

export const isStaff = (actor: Actor): actor is StaffActor => actor.type === UserType.STAFF;
