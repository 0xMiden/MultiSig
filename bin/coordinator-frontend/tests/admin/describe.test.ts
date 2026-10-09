import { describe, it, expect } from 'vitest';
import { describeAdminRecipe } from '@/lib/admin/describe';
import type { AdminRecipe, AdminActionArgs } from '@/lib/admin/recipe';

function recipeFor(actionArgs: AdminActionArgs): AdminRecipe {
  return {
    recipeVersion: 1,
    action: actionArgs.action,
    senderAccountId: '0xsender',
    faucetId: '0xfaucet',
    feeFaucetId: '0xfeefaucet',
    networkId: 'devnet',
    actionArgs,
    saltHex: '0x' + '1'.repeat(64),
    boundBlockNum: 42,
  };
}

describe('describeAdminRecipe', () => {
  it('describes set_max_supply', () => {
    const r = recipeFor({ action: 'set_max_supply', maxSupply: '1000' });
    expect(describeAdminRecipe(r)).toEqual({
      title: 'Set max supply',
      lines: ['New max supply: 1000', 'Contract: USDCx faucet 0xfaucet'],
    });
  });

  it('describes set_min_burn', () => {
    const r = recipeFor({ action: 'set_min_burn', minBurn: '50' });
    expect(describeAdminRecipe(r)).toEqual({
      title: 'Set min burn',
      lines: ['New min burn: 50', 'Contract: USDCx faucet 0xfaucet'],
    });
  });

  it('describes set_note_fee', () => {
    const r = recipeFor({ action: 'set_note_fee', noteScriptRoot: '0xroot', feeAmount: '25' });
    expect(describeAdminRecipe(r)).toEqual({
      title: 'Set note fee',
      lines: [
        'Note script root: 0xroot',
        'Fee faucet: 0xfeefaucet (native, read-only)',
        'Fee amount: 25',
        'Contract: USDCx faucet 0xfaucet',
      ],
    });
  });

  it('describes rbac_grant', () => {
    const r = recipeFor({ action: 'rbac_grant', role: 'BLK_MANAGER', accountId: '0xabc' });
    expect(describeAdminRecipe(r)).toEqual({
      title: 'Grant role',
      lines: ['Role: BLK_MANAGER', 'Target: 0xabc', 'Contract: USDCx faucet 0xfaucet'],
    });
  });

  it('describes rbac_revoke', () => {
    const r = recipeFor({ action: 'rbac_revoke', role: 'BLK_MANAGER', accountId: '0xabc' });
    expect(describeAdminRecipe(r)).toEqual({
      title: 'Revoke role',
      lines: ['Role: BLK_MANAGER', 'Target: 0xabc', 'Contract: USDCx faucet 0xfaucet'],
    });
  });

  it('describes set_attester (enabled)', () => {
    const r = recipeFor({ action: 'set_attester', commitment: '0xcommit', enabled: true });
    expect(describeAdminRecipe(r)).toEqual({
      title: 'Set attester',
      lines: ['Commitment: 0xcommit', 'Enabled: yes', 'Contract: USDCx faucet 0xfaucet'],
    });
  });

  it('describes set_attester (disabled)', () => {
    const r = recipeFor({ action: 'set_attester', commitment: '0xcommit', enabled: false });
    expect(describeAdminRecipe(r)).toEqual({
      title: 'Set attester',
      lines: ['Commitment: 0xcommit', 'Enabled: no', 'Contract: USDCx faucet 0xfaucet'],
    });
  });

  it('describes pause', () => {
    const r = recipeFor({ action: 'pause' });
    expect(describeAdminRecipe(r)).toEqual({ title: 'Pause USDCx', lines: ['Contract: USDCx faucet 0xfaucet'] });
  });

  it('describes unpause', () => {
    const r = recipeFor({ action: 'unpause' });
    expect(describeAdminRecipe(r)).toEqual({ title: 'Unpause USDCx', lines: ['Contract: USDCx faucet 0xfaucet'] });
  });

  it('describes blocklist (blocked)', () => {
    const r = recipeFor({ action: 'blocklist', accountId: '0xabc', blocked: true });
    expect(describeAdminRecipe(r)).toEqual({
      title: 'Block account',
      lines: ['Target: 0xabc', 'Contract: USDCx faucet 0xfaucet'],
    });
  });

  it('describes blocklist (unblocked)', () => {
    const r = recipeFor({ action: 'blocklist', accountId: '0xabc', blocked: false });
    expect(describeAdminRecipe(r)).toEqual({
      title: 'Unblock account',
      lines: ['Target: 0xabc', 'Contract: USDCx faucet 0xfaucet'],
    });
  });

  it('describes the bridge actions with target wording', () => {
    const bridge = (actionArgs: AdminActionArgs): AdminRecipe => ({ ...recipeFor(actionArgs), target: 'agglayer' });
    expect(describeAdminRecipe(bridge({ action: 'pause' })).title).toBe('Pause bridge');
    expect(describeAdminRecipe(bridge({ action: 'unpause' })).title).toBe('Unpause bridge');
    expect(describeAdminRecipe(bridge({ action: 'rbac_set_admin', role: 'PAUSER', adminRole: null }))).toEqual({
      title: 'Set role admin', lines: ['Role: PAUSER', 'Admin role: BRIDGE_ADMIN (default)', 'Contract: AggLayer bridge 0xfaucet'],
    });
    expect(describeAdminRecipe(bridge({ action: 'rbac_set_admin', role: 'PAUSER', adminRole: 'FEE_MNGR' })).lines).toEqual(['Role: PAUSER', 'Admin role: FEE_MNGR', 'Contract: AggLayer bridge 0xfaucet']);
    expect(describeAdminRecipe(bridge({ action: 'rbac_renounce', role: 'PAUSER' }))).toEqual({ title: 'Renounce role', lines: ['Role: PAUSER', 'Contract: AggLayer bridge 0xfaucet'] });
    expect(describeAdminRecipe(bridge({ action: 'rbac_grant', role: 'ADMIN', accountId: '0x1' })).lines[0]).toBe('Role: BRIDGE_ADMIN');
    // USDCx titles unchanged
    expect(describeAdminRecipe(recipeFor({ action: 'pause' })).title).toBe('Pause USDCx');
  });

  it('names the contract on every action, so co-signers can tell the two consoles apart', () => {
    const bridge: AdminRecipe = { ...recipeFor({ action: 'rbac_grant', role: 'PAUSER', accountId: '0x1' }), target: 'agglayer', faucetId: '0xb1d6e' };
    expect(describeAdminRecipe(bridge).lines.at(-1)).toBe('Contract: AggLayer bridge 0xb1d6e');
    expect(describeAdminRecipe(recipeFor({ action: 'rbac_grant', role: 'ADMIN', accountId: '0x1' })).lines.at(-1)).toBe('Contract: USDCx faucet 0xfaucet');
  });
});
