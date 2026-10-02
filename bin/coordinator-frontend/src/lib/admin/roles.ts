import { account_has_role, rbac_role_members } from '@/lib/usdcxAdminWasm/usdcx_admin_notes';
import type { AdminAction } from '@/lib/admin/recipe';

/** The faucet's RBAC roles, verified against the faucet's own role set. */
export const ROLES = ['ADMIN', 'ATTEST_ADMIN', 'DOM_PAUSER', 'DOM_UNPAUSER', 'BLK_MANAGER'] as const;
export type Role = (typeof ROLES)[number];

/**
 * The single role gating each admin action. `pause`/`unpause` are gated by distinct roles
 * (`DOM_PAUSER`/`DOM_UNPAUSER`) even though they're a toggle pair -- do not collapse them.
 */
export const ACTION_ROLE: Record<AdminAction, Role> = {
  set_max_supply: 'ADMIN',
  set_min_burn: 'ADMIN',
  set_note_fee: 'ADMIN',
  rbac_grant: 'ADMIN',
  rbac_revoke: 'ADMIN',
  set_attester: 'ATTEST_ADMIN',
  pause: 'DOM_PAUSER',
  unpause: 'DOM_UNPAUSER',
  blocklist: 'BLK_MANAGER',
};

/**
 * Pure role evaluator: applies `check` to every role in {@link ROLES} and returns which ones it
 * approves. Kept separate from {@link evaluateRoles} so the mapping logic is unit-testable
 * without a real serialized faucet `Account` (see ruling R-pre1).
 */
export function rolesFromChecker(check: (role: Role) => boolean): Record<Role, boolean> {
  const result = {} as Record<Role, boolean>;
  for (const role of ROLES) {
    result[role] = check(role);
  }
  return result;
}

/**
 * Evaluates every role in {@link ROLES} for `accountHex` against the already-fetched, serialized
 * faucet `Account` bytes. Pure over its inputs: callers are responsible for fetching
 * `faucetBytes` and initializing the admin wasm module (`initAdminWasm()`) first.
 */
export function evaluateRoles(faucetBytes: Uint8Array, accountHex: string): Record<Role, boolean> {
  return rolesFromChecker((role) => account_has_role(faucetBytes, accountHex, role));
}

/** The admin actions each role unlocks: {@link ACTION_ROLE} read the other way round. */
export function actionsOfRole(role: Role): AdminAction[] {
  return (Object.keys(ACTION_ROLE) as AdminAction[]).filter((action) => ACTION_ROLE[action] === role);
}

/**
 * Pure counterpart of {@link listRoleHolders}: asks `list` for the holders of every role in
 * {@link ROLES}. Separate for the same reason as {@link rolesFromChecker} -- testable without a
 * serialized faucet `Account`.
 */
export function holdersFromLister(list: (role: Role) => string[]): Record<Role, string[]> {
  const result = {} as Record<Role, string[]>;
  for (const role of ROLES) {
    result[role] = list(role);
  }
  return result;
}

/**
 * Every account holding each role on the faucet, read from the faucet's RBAC membership map in
 * the already-fetched, serialized faucet `Account` bytes. As with {@link evaluateRoles}, callers
 * fetch `faucetBytes` and call `initAdminWasm()` first.
 */
export function listRoleHolders(faucetBytes: Uint8Array): Record<Role, string[]> {
  return holdersFromLister((role) => rbac_role_members(faucetBytes, role));
}

/** Short, human-readable name of what each admin action does, for listing a role's powers. */
export const ACTION_LABEL: Record<AdminAction, string> = {
  set_max_supply: 'Set the max supply',
  set_min_burn: 'Set the minimum burn amount',
  set_note_fee: 'Set note fees',
  rbac_grant: 'Grant roles',
  rbac_revoke: 'Revoke roles',
  set_attester: 'Enable or disable attesters',
  pause: 'Pause the faucet',
  unpause: 'Unpause the faucet',
  blocklist: 'Block or unblock accounts',
};
