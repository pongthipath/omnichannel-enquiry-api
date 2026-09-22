import { StaffActor } from './actor';

/**
 * Implemented by the staff module. Lets the global guard (in common) build a StaffActor
 * without importing a feature module (Dependency Inversion).
 */
export interface ActorResolver {
  /** null when the staff member no longer exists or is deactivated */
  resolveStaff(staffId: string): Promise<StaffActor | null>;
}

export const ACTOR_RESOLVER = Symbol('ACTOR_RESOLVER');

export interface JwtPayload {
  sub: string;
  typ: 'customer' | 'staff';
}
