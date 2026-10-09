import { account_has_role, rbac_role_members } from '@/lib/usdcxAdminWasm/usdcx_admin_notes';
import type { AdminAction } from '@/lib/admin/recipe';
import { ANY_HELD_ROLE, USDCX_PROFILE, actionRoleOf, roleSymbols, type AdminTargetProfile } from '@/lib/admin/target';

/** An on-chain role symbol. The set depends on the target (see `lib/admin/target`). */
export type Role = string;
/** Which of a target's roles an account holds, keyed by on-chain symbol. */
export type RoleFlags = Record<string, boolean>;

/** The USDCx faucet's roles; kept for callers that specifically mean USDCx. */
export const ROLES: readonly string[] = roleSymbols(USDCX_PROFILE);

/** Pure role evaluator over a target's roles; testable without serialized account bytes. */
export function rolesFromChecker(target: AdminTargetProfile, check: (role: string) => boolean): RoleFlags {
  const result: RoleFlags = {};
  for (const role of roleSymbols(target)) result[role] = check(role);
  return result;
}

/**
 * Evaluates every role of `target` for `accountHex` against the already-fetched, serialized
 * contract `Account` bytes. Callers fetch the bytes and run `initAdminWasm()` first.
 */
export function evaluateRoles(contractBytes: Uint8Array, accountHex: string, target: AdminTargetProfile): RoleFlags {
  return rolesFromChecker(target, (role) => account_has_role(contractBytes, accountHex, role));
}

export function holdsAnyRole(flags: RoleFlags | null): boolean {
  return !!flags && Object.values(flags).some(Boolean);
}

export function holdersFromLister(target: AdminTargetProfile, list: (role: string) => string[]): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const role of roleSymbols(target)) result[role] = list(role);
  return result;
}

export function listRoleHolders(contractBytes: Uint8Array, target: AdminTargetProfile): Record<string, string[]> {
  return holdersFromLister(target, (role) => rbac_role_members(contractBytes, role));
}

/** The target's actions `role` unlocks (renounce is open to every role holder). */
export function actionsOfRole(target: AdminTargetProfile, role: string): AdminAction[] {
  return target.actions.filter((action) => {
    const gate = actionRoleOf(target, action);
    return gate === role || gate === ANY_HELD_ROLE;
  });
}

/** Short, human-readable name of what each admin action does, for listing a role's powers. */
export function actionLabel(target: AdminTargetProfile, action: AdminAction): string {
  const noun = target.kind === 'agglayer' ? 'bridge' : 'faucet';
  switch (action) {
    case 'set_max_supply': return 'Set the max supply';
    case 'set_min_burn': return 'Set the minimum burn amount';
    case 'set_note_fee': return 'Set note fees';
    case 'rbac_grant': return 'Grant roles';
    case 'rbac_revoke': return 'Revoke roles';
    case 'rbac_set_admin': return "Change a role's admin role";
    case 'rbac_renounce': return 'Renounce a held role';
    case 'set_attester': return 'Enable or disable attesters';
    case 'pause': return `Pause the ${noun}`;
    case 'unpause': return `Unpause the ${noun}`;
    case 'blocklist': return 'Block or unblock accounts';
    default: { const unreachable: never = action; return unreachable; }
  }
}

/** Card title and one-line description of each admin action, as shown on the admin page. */
export function actionInfo(target: AdminTargetProfile, action: AdminAction): { title: string; description: string } {
  const noun = target.labels.contractNoun;
  switch (action) {
    case 'set_max_supply': return { title: 'Set max supply', description: "Sets the faucet's maximum issuable supply, in base units." };
    case 'set_min_burn': return { title: 'Set min burn', description: 'Sets the minimum amount that can be burned, in base units.' };
    case 'set_note_fee': return { title: 'Set note fee', description: 'Sets the fee required to submit notes using a given note script.' };
    case 'rbac_grant': return { title: 'Grant role', description: `Grants an RBAC role to an account on the ${noun}.` };
    case 'rbac_revoke': return { title: 'Revoke role', description: `Revokes an RBAC role from an account on the ${noun}.` };
    case 'rbac_set_admin': return { title: 'Set role admin', description: 'Changes which role administers a role (grants, revokes). Empty reverts to the root admin role.' };
    case 'rbac_renounce': return { title: 'Renounce role', description: `Gives up a role the sender holds on the ${noun}. Cannot be undone by the sender.` };
    case 'set_attester': return { title: 'Set attester', description: 'Enables or disables an attester commitment for this faucet.' };
    case 'pause': return { title: target.labels.pauseTitle, description: target.kind === 'agglayer' ? 'Emergency stop: blocks bridge-out, claims, GER injection and faucet changes.' : 'Pauses all transfers and operations on this faucet.' };
    case 'unpause': return { title: target.labels.unpauseTitle, description: target.kind === 'agglayer' ? 'Resumes bridge operations. BRIDGE_ADMIN only.' : 'Resumes transfers and operations on this faucet.' };
    case 'blocklist': return { title: 'Block or unblock account', description: "Adds or removes an account from this faucet's blocklist." };
    default: { const unreachable: never = action; return unreachable; }
  }
}
