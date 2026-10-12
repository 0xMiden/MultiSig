import { describe, it, expect } from 'vitest';
import {
  allReadable, failedEvaluations, firstConfiguredKind, noRolesSentence, selectActiveTarget, showsActionCards, targetsWithRoles,
  type TargetEvaluation,
} from '@/lib/admin/targetSelection';
import { AGGLAYER_PROFILE, USDCX_PROFILE, type AdminTarget } from '@/lib/admin/target';

const usdcx: AdminTarget = { ...USDCX_PROFILE, contractId: '0xa', feeFaucetId: '0xfee', networkId: 'testnet' };
const bridge: AdminTarget = { ...AGGLAYER_PROFILE, contractId: '0xb', feeFaucetId: '0xfee', networkId: 'testnet' };
const ready = (target: AdminTarget, roles: Record<string, boolean> | null, breadRoles: Record<string, boolean> | null = null): TargetEvaluation =>
  ({ target, status: 'ready', bytes: new Uint8Array(), roles, breadRoles, breadAccountId: breadRoles ? '0xbread' : null });
const failed = (target: AdminTarget): TargetEvaluation => ({ target, status: 'error', roles: null, breadRoles: null, breadAccountId: null, message: 'account not found' });

describe('selectActiveTarget', () => {
  it('picks the single target where anyone holds a role', () => {
    expect(selectActiveTarget([ready(usdcx, { ADMIN: false }), ready(bridge, { ADMIN: true })], null)).toBe('agglayer');
    expect(selectActiveTarget([ready(usdcx, null, { DOM_PAUSER: true }), ready(bridge, { ADMIN: false })], null)).toBe('usdcx');
  });
  it('honours the remembered choice only when it holds roles, else the first with roles', () => {
    const both = [ready(usdcx, { ADMIN: true }), ready(bridge, { ADMIN: true })];
    expect(selectActiveTarget(both, 'agglayer')).toBe('agglayer');
    expect(selectActiveTarget(both, null)).toBe('usdcx');
    expect(selectActiveTarget([ready(usdcx, { ADMIN: true }), ready(bridge, { ADMIN: false })], 'agglayer')).toBe('usdcx');
    expect(targetsWithRoles(both)).toEqual(['usdcx', 'agglayer']);
  });
  it('is null when nobody holds a role anywhere', () => {
    expect(selectActiveTarget([ready(usdcx, { ADMIN: false }), ready(bridge, null)], 'usdcx')).toBeNull();
    expect(selectActiveTarget([], null)).toBeNull();
  });
  it('skips a target the node could not serve, so the other console still works', () => {
    expect(selectActiveTarget([failed(usdcx), ready(bridge, { PAUSER: true })], 'usdcx')).toBe('agglayer');
    expect(selectActiveTarget([failed(usdcx), ready(bridge, { PAUSER: false })], null)).toBeNull();
  });
  it('with one configured target and no roles, still returns null (the page explains)', () => {
    expect(selectActiveTarget([ready(usdcx, { ADMIN: false })], null)).toBeNull();
  });
});

describe('failedEvaluations / allReadable', () => {
  it('lists unreadable contracts and only allows "no roles" when all were read', () => {
    const evals = [ready(usdcx, { ADMIN: false }), failed(bridge)];
    expect(failedEvaluations(evals).map((e) => e.target.kind)).toEqual(['agglayer']);
    expect(allReadable(evals)).toBe(false);
    expect(allReadable([ready(usdcx, { ADMIN: false })])).toBe(true);
    expect(allReadable([])).toBe(true);
  });
});

describe('firstConfiguredKind', () => {
  it('takes the first preferred kind that is configured, else the first configured', () => {
    expect(firstConfiguredKind([usdcx, bridge], 'agglayer', 'usdcx')).toBe('agglayer');
    expect(firstConfiguredKind([usdcx, bridge], null, 'agglayer')).toBe('agglayer');
    expect(firstConfiguredKind([usdcx, bridge], null, null)).toBe('usdcx');
  });
  it('ignores a preferred kind that is not configured (bridge id unset)', () => {
    expect(firstConfiguredKind([usdcx], 'agglayer', null)).toBe('usdcx');
    expect(firstConfiguredKind([], 'usdcx')).toBeNull();
  });
});

describe('showsActionCards', () => {
  it('lists every action, locked, when nobody is connected (as the USDCx console always did)', () => {
    expect(showsActionCards(false, null)).toBe(true);
    expect(showsActionCards(false, failed(usdcx))).toBe(true);
  });
  it('with someone connected, only once the shown contract was read', () => {
    expect(showsActionCards(true, ready(usdcx, { ADMIN: false }))).toBe(true);
    expect(showsActionCards(true, null)).toBe(false);
    expect(showsActionCards(true, failed(usdcx))).toBe(false);
  });
});

describe('noRolesSentence', () => {
  it('names only the parties actually connected', () => {
    expect(noRolesSentence({ multisig: true, bread: false }, [usdcx])).toBe(
      'The acting multisig holds no role on the USDCx faucet (0xa), so every action below is locked. The Roles page shows who holds each role.',
    );
    expect(noRolesSentence({ multisig: false, bread: true }, [usdcx])).toMatch(/^The connected Bread account holds no role on the USDCx faucet \(0xa\)/);
    expect(noRolesSentence({ multisig: true, bread: true }, [usdcx, bridge])).toMatch(
      /^Neither the acting multisig nor the connected Bread account holds a role on the USDCx faucet \(0xa\) or the AggLayer bridge \(0xb\),/,
    );
    expect(noRolesSentence({ multisig: true, bread: false }, [usdcx])).not.toMatch(/Bread/);
  });
});
