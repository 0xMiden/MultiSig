import { rbac_role_members } from '@/lib/usdcxAdminWasm/usdcx_admin_notes';
import { initAdminWasm } from '@/lib/admin/noteBuilders';
import type { AdminRecipe } from '@/lib/admin/recipe';

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
 * Last-ADMIN guardrail. Only relevant for an `rbac_revoke` of the `ADMIN` role: computes what the
 * ADMIN member set would look like after the proposed revoke lands, and `block`s if that would be
 * empty (a permanent, unrecoverable lockout). Short of that, `warn`s when the acting multisig is
 * revoking its own ADMIN membership (it may lose the ability to manage this faucet from this
 * account, even though other ADMINs remain).
 *
 * Pure over its inputs -- callers fetch `adminMembers` via `rbac_role_members(faucetBytes,
 * 'ADMIN')` first (see {@link runGuardrails}).
 */
export function decideLastAdmin(
  adminMembers: string[],
  actingAccountId: string,
  recipe: AdminRecipe,
): GuardrailResult {
  if (recipe.action !== 'rbac_revoke' || recipe.actionArgs.action !== 'rbac_revoke') return OK;
  const { role, accountId: target } = recipe.actionArgs;
  if (role !== 'ADMIN') return OK;

  const remaining = adminMembers.filter((member) => !sameAccount(member, target));
  if (remaining.length === 0) {
    return {
      level: 'block',
      message:
        'This would revoke the last ADMIN on this faucet, permanently locking out administration. The chain does not prevent this -- it cannot be undone.',
    };
  }
  if (sameAccount(target, actingAccountId)) {
    return {
      level: 'warn',
      message:
        'This revokes ADMIN from the multisig you are currently acting as. Other ADMINs remain, but you may lose the ability to manage this faucet from this account.',
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

const SEVERITY: Record<GuardrailResult['level'], number> = { ok: 0, warn: 1, block: 2 };

function mostSevere(results: GuardrailResult[]): GuardrailResult {
  return results.reduce((acc, r) => (SEVERITY[r.level] > SEVERITY[acc.level] ? r : acc), OK);
}

/**
 * Composes all three guardrails for a proposed `recipe`. Fetches the current ADMIN member set via
 * `rbac_role_members` (initializing the admin wasm module first) and returns the single most
 * severe result (`block` > `warn` > `ok`). The UI blocks submission on `block` and requires an
 * explicit typed confirmation on `warn`.
 *
 * Per ruling R-pre1, this wrapper is intentionally NOT unit-tested against real serialized faucet
 * bytes (infeasible in JS -- `rbac_role_members` is proven by the Rust crate's own tests); it is
 * exercised end-to-end in Task 14. Only the pure `decide*` functions above are unit-tested here.
 */
export async function runGuardrails(
  faucetBytes: Uint8Array,
  recipe: AdminRecipe,
  inflightRecipes: AdminRecipe[],
): Promise<GuardrailResult> {
  await initAdminWasm();
  const adminMembers = rbac_role_members(faucetBytes, 'ADMIN');
  return mostSevere([
    decideLastAdmin(adminMembers, recipe.senderAccountId, recipe),
    decideRoleSeparation(recipe, recipe.senderAccountId),
    decideRevokeInFlight(recipe, inflightRecipes),
  ]);
}
