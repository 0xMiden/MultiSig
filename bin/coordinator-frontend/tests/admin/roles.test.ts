import { describe, it, expect, vi } from 'vitest';
import { ACTION_ROLE, ROLES, actionsOfRole, holdersFromLister, rolesFromChecker, type Role } from '@/lib/admin/roles';

// Per ruling R-pre1: unit-test only the PURE logic here. `evaluateRoles` wraps
// `account_has_role` over a real serialized faucet `Account`, which this suite does not attempt
// to construct (infeasible in JS — see the brief); it is proven by the Rust crate's own tests and
// exercised end-to-end in Task 14. `useFaucetRoles` has no component test harness and is also
// e2e-covered.

describe('ACTION_ROLE', () => {
  it('maps pause to DOM_PAUSER and unpause to DOM_UNPAUSER', () => {
    expect(ACTION_ROLE.pause).toBe('DOM_PAUSER');
    expect(ACTION_ROLE.unpause).toBe('DOM_UNPAUSER');
  });

  it('maps blocklist to BLK_MANAGER', () => {
    expect(ACTION_ROLE.blocklist).toBe('BLK_MANAGER');
  });

  it('maps set_attester to ATTEST_ADMIN', () => {
    expect(ACTION_ROLE.set_attester).toBe('ATTEST_ADMIN');
  });

  it('maps the five admin-gated actions to ADMIN', () => {
    expect(ACTION_ROLE.set_max_supply).toBe('ADMIN');
    expect(ACTION_ROLE.set_min_burn).toBe('ADMIN');
    expect(ACTION_ROLE.set_note_fee).toBe('ADMIN');
    expect(ACTION_ROLE.rbac_grant).toBe('ADMIN');
    expect(ACTION_ROLE.rbac_revoke).toBe('ADMIN');
  });
});

describe('rolesFromChecker', () => {
  it('reports true only for the role the checker approves', () => {
    const roles = rolesFromChecker((role) => role === 'ADMIN');
    expect(roles).toEqual({
      ADMIN: true,
      ATTEST_ADMIN: false,
      DOM_PAUSER: false,
      DOM_UNPAUSER: false,
      BLK_MANAGER: false,
    });
  });

  it('is all-false for a checker that never approves', () => {
    const roles = rolesFromChecker(() => false);
    for (const role of ROLES) {
      expect(roles[role]).toBe(false);
    }
  });

  it('is all-true for a checker that always approves', () => {
    const roles = rolesFromChecker(() => true);
    for (const role of ROLES) {
      expect(roles[role]).toBe(true);
    }
  });

  it('calls the checker exactly once per role, covering all 5 roles', () => {
    const seen: Role[] = [];
    const checker = vi.fn((role: Role) => {
      seen.push(role);
      return false;
    });
    rolesFromChecker(checker);
    expect(checker).toHaveBeenCalledTimes(ROLES.length);
    expect(new Set(seen)).toEqual(new Set(ROLES));
    // No duplicate calls for any role.
    expect(seen.length).toBe(new Set(seen).size);
  });
});

describe('actionsOfRole', () => {
  it('lists every action a role unlocks, and each action exactly once across roles', () => {
    expect(actionsOfRole('ADMIN')).toEqual(['set_max_supply', 'set_min_burn', 'set_note_fee', 'rbac_grant', 'rbac_revoke']);
    expect(actionsOfRole('DOM_PAUSER')).toEqual(['pause']);
    expect(actionsOfRole('DOM_UNPAUSER')).toEqual(['unpause']);
    const all = ROLES.flatMap((role) => actionsOfRole(role));
    expect(all.sort()).toEqual(Object.keys(ACTION_ROLE).sort());
  });
});

describe('holdersFromLister', () => {
  it('asks for every role once and keeps each role with its own holders', () => {
    const asked: string[] = [];
    const holders = holdersFromLister((role) => {
      asked.push(role);
      return role === 'ADMIN' ? ['0xaa', '0xbb'] : role === 'BLK_MANAGER' ? ['0xcc'] : [];
    });
    expect(asked).toEqual([...ROLES]);
    expect(holders).toEqual({
      ADMIN: ['0xaa', '0xbb'],
      ATTEST_ADMIN: [],
      DOM_PAUSER: [],
      DOM_UNPAUSER: [],
      BLK_MANAGER: ['0xcc'],
    });
  });
});
