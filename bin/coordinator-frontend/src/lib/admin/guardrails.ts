import { rbac_role_members } from '@/lib/usdcxAdminWasm/usdcx_admin_notes';
import { initAdminWasm } from '@/lib/admin/noteBuilders';
import { recipeTarget, type AdminRecipe } from '@/lib/admin/recipe';
import { roleLabel, type AdminTargetProfile } from '@/lib/admin/target';

/**
 * These guardrails are frontend-only safety conveniences -- the chain enforces none of them.
 * They guard against proposing a transition that would permanently and unrecoverably lock an
 * operator out of administering the faucet (losing the last ADMIN) or that mixes administrative
 * and operational control, and they flag (but never block) a revoke that could strand an
 * in-flight proposal signed by the soon-revoked holder.
 */
export type GuardrailResult =
  | { level: 'ok' }
  | { level: 'warn'; message: string }
  | { level: 'block'; message: string };

const OK: GuardrailResult = { level: 'ok' };

/** Case/whitespace-insensitive account id comparison -- recipes and wasm both hand back hex ids
 * that may differ only in case. */
function normalizeAccountId(accountId: string): string {
  return accountId.trim().toLowerCase();
}

function sameAccount(a: string, b: string): boolean {
  return normalizeAccountId(a) === normalizeAccountId(b);
}

/**
 * Last-ADMIN guardrail: an `rbac_revoke` of `ADMIN`, or an `rbac_renounce` of `ADMIN` by the acting
 * account, must not empty the root role (a permanent, unrecoverable lockout; the bridge spec:
 * "BRIDGE_ADMIN must never be emptied"). Short of that, `warn`s when the acting account is the one
 * losing ADMIN. Pure: callers fetch `adminMembers` via `rbac_role_members(bytes, 'ADMIN')`.
 */
export function decideLastAdmin(
  adminMembers: string[],
  actingAccountId: string,
  recipe: AdminRecipe,
  target: AdminTargetProfile,
): GuardrailResult {
  const args = recipe.actionArgs;
  let losing: string;
  if (args.action === 'rbac_revoke' && args.role === 'ADMIN') losing = args.accountId;
  else if (args.action === 'rbac_renounce' && args.role === 'ADMIN') losing = actingAccountId;
  else return OK;

  const admin = roleLabel(target, 'ADMIN');
  const noun = target.labels.contractNoun;
  const remaining = adminMembers.filter((member) => !sameAccount(member, losing));
  if (remaining.length === 0) {
    return {
      level: 'block',
      message: `This would remove the last ${admin} on this ${noun}, permanently locking out administration. The chain does not prevent this -- it cannot be undone.`,
    };
  }
  if (sameAccount(losing, actingAccountId)) {
    return {
      level: 'warn',
      message: `This removes ${admin} from the account you are acting as. Other ${admin}s remain, but you may lose the ability to manage this ${noun} from this account.`,
    };
  }
  return OK;
}

/**
 * Role-separation guardrail. Refuses (`block`) a proposed `rbac_grant` that would give the acting
 * (admin) multisig an operational role (`DOM_PAUSER` or `BLK_MANAGER`), which would combine
 * administrative and operational control in a single signer set. Grants of other roles, or grants
 * to any other account, are unaffected.
 */
export function decideRoleSeparation(recipe: AdminRecipe, actingAccountId: string): GuardrailResult {
  if (recipe.action !== 'rbac_grant' || recipe.actionArgs.action !== 'rbac_grant') return OK;
  const { role, accountId: target } = recipe.actionArgs;
  if (!sameAccount(target, actingAccountId)) return OK;
  if (role === 'DOM_PAUSER' || role === 'BLK_MANAGER') {
    return {
      level: 'block',
      message: `Granting ${role} to the acting admin multisig combines administrative and operational control. Use a separate account for this operational role.`,
    };
  }
  return OK;
}

/**
 * Revoke-in-flight guardrail. `warn`s (never blocks) when a proposed `rbac_revoke` targets an
 * account that is the sender of an in-flight (not yet finalized) admin proposal -- that queued
 * proposal may fail to execute once the revoke lands, since its signer will have lost the role it
 * needed.
 */
export function decideRevokeInFlight(recipe: AdminRecipe, inflightRecipes: AdminRecipe[]): GuardrailResult {
  if (recipe.action !== 'rbac_revoke' || recipe.actionArgs.action !== 'rbac_revoke') return OK;
  const { accountId: target } = recipe.actionArgs;
  const conflicting = inflightRecipes.some((inflight) => sameAccount(inflight.senderAccountId, target));
  if (conflicting) {
    return {
      level: 'warn',
      message:
        'There is an in-flight admin proposal signed by the account whose role is being revoked. It may fail to execute once this revoke lands.',
    };
  }
  return OK;
}

/**
 * Bridge-only: the order in which pending notes are consumed is not under the operator's control,
 * so an ADMIN grant and an ADMIN revoke/renounce must not be in flight at the same time (the
 * revoke could land first and leave the grant unauthorised, or the reverse). `warn`s; never blocks.
 */
export function decideAdminChurnInFlight(recipe: AdminRecipe, inflightRecipes: AdminRecipe[]): GuardrailResult {
  if (recipeTarget(recipe) !== 'agglayer') return OK;
  const kind = (r: AdminRecipe): 'grant' | 'remove' | null => {
    const a = r.actionArgs;
    if (a.action === 'rbac_grant' && a.role === 'ADMIN') return 'grant';
    if ((a.action === 'rbac_revoke' || a.action === 'rbac_renounce') && a.role === 'ADMIN') return 'remove';
    return null;
  };
  const mine = kind(recipe);
  if (!mine) return OK;
  const opposite = mine === 'grant' ? 'remove' : 'grant';
  if (inflightRecipes.some((r) => recipeTarget(r) === 'agglayer' && kind(r) === opposite)) {
    return {
      level: 'warn',
      message:
        'A BRIDGE_ADMIN grant and a BRIDGE_ADMIN revoke/renounce would be in flight at the same time. The bridge consumes pending notes in any order; wait for the other proposal to land first.',
    };
  }
  return OK;
}

/**
 * Set-role-admin guardrail. The root role must stay self-administered: re-parenting `ADMIN` (any
 * non-null admin role) is `block`ed -- while the new admin role has members, ADMIN delegation is
 * theirs alone and they could then empty ADMIN. Delegating another role to a non-root admin role is
 * allowed on-chain but `warn`s: the console gates grant/revoke on the root role. Clearing back to
 * the default (`null`), or naming the root explicitly, is `ok`.
 */
export function decideSetRoleAdmin(recipe: AdminRecipe, target: AdminTargetProfile): GuardrailResult {
  const args = recipe.actionArgs;
  if (args.action !== 'rbac_set_admin' || args.adminRole === null) return OK;
  const root = roleLabel(target, 'ADMIN');
  if (args.role === 'ADMIN') {
    return {
      level: 'block',
      message: `This would delegate ${root} administration to another role; the root role must stay self-administered.`,
    };
  }
  if (args.adminRole === 'ADMIN') return OK;
  return {
    level: 'warn',
    message: `${roleLabel(target, args.role)} will then be granted/revoked by ${roleLabel(target, args.adminRole)} holders, not by ${root}; the console's action gating assumes the root admin.`,
  };
}

const SEVERITY: Record<GuardrailResult['level'], number> = { ok: 0, warn: 1, block: 2 };

function mostSevere(results: GuardrailResult[]): GuardrailResult {
  return results.reduce((acc, r) => (SEVERITY[r.level] > SEVERITY[acc.level] ? r : acc), OK);
}

/**
 * Composes all five guardrails for a proposed `recipe`. Fetches the current ADMIN member set via
 * `rbac_role_members` (initializing the admin wasm module first) and returns the single most
 * severe result (`block` > `warn` > `ok`). The UI blocks submission on `block` and requires an
 * explicit typed confirmation on `warn`.
 *
 * Per ruling R-pre1, this wrapper is intentionally NOT unit-tested against real serialized faucet
 * bytes (infeasible in JS -- `rbac_role_members` is proven by the Rust crate's own tests); it is
 * exercised end-to-end in Task 14. Only the pure `decide*` functions above are unit-tested here.
 */
export async function runGuardrails(
  contractBytes: Uint8Array,
  target: AdminTargetProfile,
  recipe: AdminRecipe,
  inflightRecipes: AdminRecipe[],
): Promise<GuardrailResult> {
  await initAdminWasm();
  const adminMembers = rbac_role_members(contractBytes, 'ADMIN');
  return mostSevere([
    decideLastAdmin(adminMembers, recipe.senderAccountId, recipe, target),
    decideRoleSeparation(recipe, recipe.senderAccountId),
    decideRevokeInFlight(recipe, inflightRecipes),
    decideAdminChurnInFlight(recipe, inflightRecipes),
    decideSetRoleAdmin(recipe, target),
  ]);
}
