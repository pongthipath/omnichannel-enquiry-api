import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { Permission } from '../permissions/permission.enum';
import { Actor } from './actor';

export const IS_PUBLIC = 'isPublic';
export const REQUIRED_PERMISSIONS = 'requiredPermissions';

/** Route needs no login (login, refresh, health, webhooks). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/**
 * Staff-only route that needs these permission bits (all of them).
 * Customers are rejected. Routes shared by customers and staff don't use this; their services scope the data.
 */
export const RequirePermission = (...permissions: Permission[]) =>
  SetMetadata(REQUIRED_PERMISSIONS, permissions);

/** The authenticated customer or staff member. */
export const CurrentActor = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): Actor => ctx.switchToHttp().getRequest().actor,
);
