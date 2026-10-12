import { describe, it, expect } from 'vitest';
import {
  ROLES, actionInfo, actionLabel, actionsOfRole, holdersFromLister, holdsAnyRole, rolesFromChecker,
} from '@/lib/admin/roles';
import { AGGLAYER_PROFILE, USDCX_PROFILE, actionRoleOf } from '@/lib/admin/target';

describe('USDCx action gating is unchanged', () => {
  it('maps the nine actions to their roles', () => {
    expect(actionRoleOf(USDCX_PROFILE, 'pause')).toBe('DOM_PAUSER');
    expect(actionRoleOf(USDCX_PROFILE, 'unpause')).toBe('DOM_UNPAUSER');
    expect(actionRoleOf(USDCX_PROFILE, 'blocklist')).toBe('BLK_MANAGER');
    expect(actionRoleOf(USDCX_PROFILE, 'set_attester')).toBe('ATTEST_ADMIN');
    for (const a of ['set_max_supply', 'set_min_burn', 'set_note_fee', 'rbac_grant', 'rbac_revoke'] as const) {
      expect(actionRoleOf(USDCX_PROFILE, a)).toBe('ADMIN');
    }
    expect(ROLES).toEqual(['ADMIN', 'ATTEST_ADMIN', 'DOM_PAUSER', 'DOM_UNPAUSER', 'BLK_MANAGER']);
  });
});

describe('rolesFromChecker / holdersFromLister', () => {
  it('evaluates exactly the target roles, once each', () => {
    const seen: string[] = [];
    const flags = rolesFromChecker(AGGLAYER_PROFILE, (role) => { seen.push(role); return role === 'PAUSER'; });
    expect(seen).toEqual(['ADMIN', 'PAUSER', 'FAUCET_MNGR', 'GER_INJECTOR', 'GER_REMOVER', 'FEE_MNGR']);
    expect(flags).toEqual({ ADMIN: false, PAUSER: true, FAUCET_MNGR: false, GER_INJECTOR: false, GER_REMOVER: false, FEE_MNGR: false });
    expect(holdersFromLister(USDCX_PROFILE, (role) => (role === 'ADMIN' ? ['0x1'] : []))).toEqual({
      ADMIN: ['0x1'], ATTEST_ADMIN: [], DOM_PAUSER: [], DOM_UNPAUSER: [], BLK_MANAGER: [],
    });
  });
  it('holdsAnyRole', () => {
    expect(holdsAnyRole(null)).toBe(false);
    expect(holdsAnyRole({ ADMIN: false })).toBe(false);
    expect(holdsAnyRole({ ADMIN: false, PAUSER: true })).toBe(true);
  });
});

describe('actionsOfRole / labels', () => {
  it('lists what each bridge role can do, renounce for every role', () => {
    expect(actionsOfRole(AGGLAYER_PROFILE, 'ADMIN')).toEqual(['rbac_grant', 'rbac_revoke', 'rbac_set_admin', 'rbac_renounce', 'unpause']);
    expect(actionsOfRole(AGGLAYER_PROFILE, 'PAUSER')).toEqual(['rbac_renounce', 'pause']);
    expect(actionsOfRole(AGGLAYER_PROFILE, 'FEE_MNGR')).toEqual(['rbac_renounce']);
    expect(actionsOfRole(USDCX_PROFILE, 'DOM_PAUSER')).toEqual(['pause']);
  });
  it('titles follow the target', () => {
    expect(actionInfo(USDCX_PROFILE, 'pause').title).toBe('Pause USDCx');
    expect(actionInfo(AGGLAYER_PROFILE, 'pause').title).toBe('Pause bridge');
    expect(actionInfo(AGGLAYER_PROFILE, 'rbac_set_admin').title).toBe('Set role admin');
    expect(actionLabel(AGGLAYER_PROFILE, 'rbac_renounce')).toBe('Renounce a held role');
    expect(actionLabel(AGGLAYER_PROFILE, 'pause')).toBe('Pause the bridge');
    expect(actionLabel(USDCX_PROFILE, 'pause')).toBe('Pause the faucet');
  });
});
