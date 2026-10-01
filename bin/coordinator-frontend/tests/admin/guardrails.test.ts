import { describe, it, expect } from 'vitest';
import {
  decideLastAdmin,
  decideRoleSeparation,
  decideRevokeInFlight,
  type GuardrailResult,
} from '@/lib/admin/guardrails';
import type { AdminRecipe } from '@/lib/admin/recipe';

// Per ruling R-pre1: unit-test only the PURE `decide*` functions with injected data.
// `runGuardrails` wraps `rbac_role_members` over a real serialized faucet `Account`, which this
// suite does not attempt to construct (infeasible in JS) -- it is proven by the Rust crate's own
// tests and exercised end-to-end in Task 14.

const SELF = '0xaaa';
const OTHER = '0xbbb';
const salt = '0x' + '1'.repeat(64);

function recipe(overrides: Partial<AdminRecipe> = {}): AdminRecipe {
  return {
    recipeVersion: 1,
    action: 'rbac_revoke',
    senderAccountId: SELF,
    faucetId: '0xfff',
    feeFaucetId: '0xfee',
    networkId: 'devnet',
    actionArgs: { action: 'rbac_revoke', role: 'ADMIN', accountId: OTHER },
    saltHex: salt,
    boundBlockNum: 42,
    ...overrides,
  };
}

function expectLevel(result: GuardrailResult, level: GuardrailResult['level']) {
  expect(result.level).toBe(level);
}

describe('decideLastAdmin', () => {
  it('blocks revoking the only ADMIN', () => {
    const r = recipe({ actionArgs: { action: 'rbac_revoke', role: 'ADMIN', accountId: OTHER } });
    const result = decideLastAdmin([OTHER], SELF, r);
    expectLevel(result, 'block');
  });

  it('is ok revoking one of two ADMINs by a different account', () => {
    const r = recipe({ actionArgs: { action: 'rbac_revoke', role: 'ADMIN', accountId: OTHER } });
    const result = decideLastAdmin([OTHER, SELF], '0xccc', r);
    expectLevel(result, 'ok');
  });

  it('warns when the acting multisig revokes its own (non-last) ADMIN', () => {
    const r = recipe({ actionArgs: { action: 'rbac_revoke', role: 'ADMIN', accountId: SELF } });
    const result = decideLastAdmin([SELF, OTHER], SELF, r);
    expectLevel(result, 'warn');
  });

  it('is ok for a revoke of a non-ADMIN role', () => {
    const r = recipe({ actionArgs: { action: 'rbac_revoke', role: 'DOM_PAUSER', accountId: OTHER } });
    const result = decideLastAdmin([OTHER], SELF, r);
    expectLevel(result, 'ok');
  });

  it('is ok for a non-revoke action', () => {
    const r = recipe({
      action: 'rbac_grant',
      actionArgs: { action: 'rbac_grant', role: 'ADMIN', accountId: OTHER },
    });
    const result = decideLastAdmin([OTHER], SELF, r);
    expectLevel(result, 'ok');
  });

  it('is case-insensitive when comparing account ids', () => {
    const r = recipe({ actionArgs: { action: 'rbac_revoke', role: 'ADMIN', accountId: OTHER.toUpperCase() } });
    const result = decideLastAdmin([OTHER], SELF, r);
    expectLevel(result, 'block');
  });
});

describe('decideRoleSeparation', () => {
  it('blocks granting DOM_PAUSER to the acting multisig', () => {
    const r = recipe({
      action: 'rbac_grant',
      actionArgs: { action: 'rbac_grant', role: 'DOM_PAUSER', accountId: SELF },
    });
    const result = decideRoleSeparation(r, SELF);
    expectLevel(result, 'block');
  });

  it('blocks granting BLK_MANAGER to the acting multisig', () => {
    const r = recipe({
      action: 'rbac_grant',
      actionArgs: { action: 'rbac_grant', role: 'BLK_MANAGER', accountId: SELF },
    });
    const result = decideRoleSeparation(r, SELF);
    expectLevel(result, 'block');
  });

  it('is ok granting DOM_PAUSER to a different account', () => {
    const r = recipe({
      action: 'rbac_grant',
      actionArgs: { action: 'rbac_grant', role: 'DOM_PAUSER', accountId: OTHER },
    });
    const result = decideRoleSeparation(r, SELF);
    expectLevel(result, 'ok');
  });

  it('is ok granting ADMIN or ATTEST_ADMIN to the acting multisig', () => {
    const grantAdmin = recipe({
      action: 'rbac_grant',
      actionArgs: { action: 'rbac_grant', role: 'ADMIN', accountId: SELF },
    });
    expectLevel(decideRoleSeparation(grantAdmin, SELF), 'ok');

    const grantAttest = recipe({
      action: 'rbac_grant',
      actionArgs: { action: 'rbac_grant', role: 'ATTEST_ADMIN', accountId: SELF },
    });
    expectLevel(decideRoleSeparation(grantAttest, SELF), 'ok');
  });

  it('is ok for a non-grant action', () => {
    const r = recipe();
    expectLevel(decideRoleSeparation(r, SELF), 'ok');
  });
});

describe('decideRevokeInFlight', () => {
  it('warns when an in-flight proposal was created by the soon-revoked holder', () => {
    const revoke = recipe({ actionArgs: { action: 'rbac_revoke', role: 'ADMIN', accountId: OTHER } });
    const inflight = recipe({
      senderAccountId: OTHER,
      action: 'set_min_burn',
      actionArgs: { action: 'set_min_burn', minBurn: '5' },
    });
    const result = decideRevokeInFlight(revoke, [inflight]);
    expectLevel(result, 'warn');
  });

  it('is ok with no in-flight proposals', () => {
    const revoke = recipe({ actionArgs: { action: 'rbac_revoke', role: 'ADMIN', accountId: OTHER } });
    expectLevel(decideRevokeInFlight(revoke, []), 'ok');
  });

  it('is ok when in-flight proposals were created by other accounts', () => {
    const revoke = recipe({ actionArgs: { action: 'rbac_revoke', role: 'ADMIN', accountId: OTHER } });
    const inflight = recipe({
      senderAccountId: '0xccc',
      action: 'set_min_burn',
      actionArgs: { action: 'set_min_burn', minBurn: '5' },
    });
    expectLevel(decideRevokeInFlight(revoke, [inflight]), 'ok');
  });

  it('is ok for a non-revoke action', () => {
    const grant = recipe({
      action: 'rbac_grant',
      actionArgs: { action: 'rbac_grant', role: 'ADMIN', accountId: OTHER },
    });
    const inflight = recipe({ senderAccountId: OTHER });
    expectLevel(decideRevokeInFlight(grant, [inflight]), 'ok');
  });
});
