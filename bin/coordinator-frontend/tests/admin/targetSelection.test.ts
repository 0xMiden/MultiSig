import { describe, it, expect } from 'vitest';
import { selectActiveTarget, targetsWithRoles, type TargetEvaluation } from '@/lib/admin/targetSelection';
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
