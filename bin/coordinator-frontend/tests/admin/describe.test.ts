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
      lines: ['New max supply: 1000'],
    });
  });

  it('describes set_min_burn', () => {
    const r = recipeFor({ action: 'set_min_burn', minBurn: '50' });
    expect(describeAdminRecipe(r)).toEqual({
      title: 'Set min burn',
      lines: ['New min burn: 50'],
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
      ],
    });
  });

  it('describes rbac_grant', () => {
    const r = recipeFor({ action: 'rbac_grant', role: 'BLK_MANAGER', accountId: '0xabc' });
    expect(describeAdminRecipe(r)).toEqual({
      title: 'Grant role',
      lines: ['Role: BLK_MANAGER', 'Target: 0xabc'],
    });
  });

  it('describes rbac_revoke', () => {
    const r = recipeFor({ action: 'rbac_revoke', role: 'BLK_MANAGER', accountId: '0xabc' });
    expect(describeAdminRecipe(r)).toEqual({
      title: 'Revoke role',
      lines: ['Role: BLK_MANAGER', 'Target: 0xabc'],
    });
  });

  it('describes set_attester (enabled)', () => {
    const r = recipeFor({ action: 'set_attester', commitment: '0xcommit', enabled: true });
    expect(describeAdminRecipe(r)).toEqual({
      title: 'Set attester',
      lines: ['Commitment: 0xcommit', 'Enabled: yes'],
    });
  });

  it('describes set_attester (disabled)', () => {
    const r = recipeFor({ action: 'set_attester', commitment: '0xcommit', enabled: false });
    expect(describeAdminRecipe(r)).toEqual({
      title: 'Set attester',
      lines: ['Commitment: 0xcommit', 'Enabled: no'],
    });
  });

  it('describes pause', () => {
    const r = recipeFor({ action: 'pause' });
    expect(describeAdminRecipe(r)).toEqual({ title: 'Pause USDCx', lines: [] });
  });

  it('describes unpause', () => {
    const r = recipeFor({ action: 'unpause' });
    expect(describeAdminRecipe(r)).toEqual({ title: 'Unpause USDCx', lines: [] });
  });

  it('describes blocklist (blocked)', () => {
    const r = recipeFor({ action: 'blocklist', accountId: '0xabc', blocked: true });
    expect(describeAdminRecipe(r)).toEqual({
      title: 'Block account',
      lines: ['Target: 0xabc'],
    });
  });

  it('describes blocklist (unblocked)', () => {
    const r = recipeFor({ action: 'blocklist', accountId: '0xabc', blocked: false });
    expect(describeAdminRecipe(r)).toEqual({
      title: 'Unblock account',
      lines: ['Target: 0xabc'],
    });
  });
});
