import { Permission, PERMISSION_IMPLIES } from './permission.enum';

/** bit 63 is the sign bit of Postgres bigint — never used. */
export const MAX_PERMISSION_BIT = 62;

export const bit = (p: Permission): bigint => 1n << BigInt(p);

export const hasPermission = (mask: bigint, p: Permission): boolean => (mask & bit(p)) !== 0n;

export const toMask = (permissions: Permission[]): bigint =>
  permissions.reduce((mask, p) => mask | bit(p), 0n);

export const fromMask = (mask: bigint): Permission[] =>
  (Object.values(Permission).filter((v) => typeof v === 'number') as Permission[]).filter((p) =>
    hasPermission(mask, p),
  );

/** Adds implied permissions (edit ⇒ view) until nothing changes. */
export const normalizeMask = (mask: bigint): bigint => {
  let result = mask;
  let changed = true;
  while (changed) {
    changed = false;
    for (const [p, implied] of Object.entries(PERMISSION_IMPLIES)) {
      if (!hasPermission(result, Number(p) as Permission)) continue;
      for (const i of implied ?? []) {
        if (!hasPermission(result, i)) {
          result |= bit(i);
          changed = true;
        }
      }
    }
  }
  return result;
};
