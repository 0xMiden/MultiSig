import { describe, it, expect, afterEach } from 'vitest';
import {
  AGGLAYER_PROFILE, ANY_HELD_ROLE, USDCX_PROFILE, actionRoleOf, profileOf, roleLabel, roleSymbols,
} from '@/lib/admin/target';
import { getAdminTargets, targetOfKind } from '@/config/adminConfig';

describe('profiles', () => {
  it('USDCx keeps its five roles and nine actions, in the existing order', () => {
    expect(roleSymbols(USDCX_PROFILE)).toEqual(['ADMIN', 'ATTEST_ADMIN', 'DOM_PAUSER', 'DOM_UNPAUSER', 'BLK_MANAGER']);
    expect(USDCX_PROFILE.actions).toEqual([
      'set_max_supply', 'set_min_burn', 'set_note_fee', 'rbac_grant', 'rbac_revoke', 'set_attester', 'pause', 'unpause', 'blocklist',
    ]);
    expect(actionRoleOf(USDCX_PROFILE, 'pause')).toBe('DOM_PAUSER');
    expect(actionRoleOf(USDCX_PROFILE, 'rbac_renounce')).toBeNull();
    expect(USDCX_PROFILE.labelPrefix).toBe('usdcx_v1_');
  });

  it('AggLayer has the six bridge roles, BRIDGE_ADMIN as the label of ADMIN, and six actions', () => {
    expect(roleSymbols(AGGLAYER_PROFILE)).toEqual(['ADMIN', 'PAUSER', 'FAUCET_MNGR', 'GER_INJECTOR', 'GER_REMOVER', 'FEE_MNGR']);
    expect(roleLabel(AGGLAYER_PROFILE, 'ADMIN')).toBe('BRIDGE_ADMIN');
    expect(roleLabel(USDCX_PROFILE, 'ADMIN')).toBe('ADMIN');
    expect(AGGLAYER_PROFILE.actions).toEqual(['rbac_grant', 'rbac_revoke', 'rbac_set_admin', 'rbac_renounce', 'pause', 'unpause']);
    expect(actionRoleOf(AGGLAYER_PROFILE, 'pause')).toBe('PAUSER');
    expect(actionRoleOf(AGGLAYER_PROFILE, 'unpause')).toBe('ADMIN');
    expect(actionRoleOf(AGGLAYER_PROFILE, 'rbac_renounce')).toBe(ANY_HELD_ROLE);
    expect(actionRoleOf(AGGLAYER_PROFILE, 'set_max_supply')).toBeNull();
    expect(AGGLAYER_PROFILE.labelPrefix).toBe('agg_v1_');
    expect(profileOf('agglayer')).toBe(AGGLAYER_PROFILE);
  });
});

describe('getAdminTargets', () => {
  const env = process.env;
  afterEach(() => { process.env = env; });

  it('lists only configured contracts, USDCx first', () => {
    process.env = { ...env, NEXT_PUBLIC_USDCX_FAUCET_ID: '0xaaa', NEXT_PUBLIC_USDCX_FEE_FAUCET_ID: '0xfee', NEXT_PUBLIC_AGGLAYER_BRIDGE_ID: '0xbbb', NEXT_PUBLIC_MIDEN_NETWORK: 'testnet' };
    const targets = getAdminTargets();
    expect(targets.map((t) => [t.kind, t.contractId, t.feeFaucetId, t.networkId])).toEqual([
      ['usdcx', '0xaaa', '0xfee', 'testnet'],
      ['agglayer', '0xbbb', '0xfee', 'testnet'],
    ]);
    expect(targetOfKind('agglayer')?.labels.contractNoun).toBe('AggLayer bridge');
  });

  it('omits AggLayer when the bridge id is unset', () => {
    process.env = { ...env, NEXT_PUBLIC_USDCX_FAUCET_ID: '0xaaa', NEXT_PUBLIC_USDCX_FEE_FAUCET_ID: '0xfee', NEXT_PUBLIC_AGGLAYER_BRIDGE_ID: '' };
    expect(getAdminTargets().map((t) => t.kind)).toEqual(['usdcx']);
    expect(targetOfKind('agglayer')).toBeNull();
  });

  it('is empty with nothing configured', () => {
    process.env = { ...env, NEXT_PUBLIC_USDCX_FAUCET_ID: '', NEXT_PUBLIC_AGGLAYER_BRIDGE_ID: '' };
    expect(getAdminTargets()).toEqual([]);
  });
});
