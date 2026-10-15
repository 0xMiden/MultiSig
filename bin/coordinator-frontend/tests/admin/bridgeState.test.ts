import { describe, it, expect } from 'vitest';
import { bridgeStateFromBytes, pauseStatus } from '@/lib/admin/bridgeState';
import { AGGLAYER_PROFILE, USDCX_PROFILE } from '@/lib/admin/target';

const bytes = new Uint8Array([1, 2, 3]);

describe('bridgeStateFromBytes', () => {
  it('reports the paused flag and holder counts', () => {
    const result = bridgeStateFromBytes(bytes, AGGLAYER_PROFILE, {
      listRoleHolders: () => ({ ADMIN: ['0x1', '0x2'], PAUSER: [] }),
      readIsPaused: () => true,
    });
    expect(result).toEqual({ status: 'ready', paused: true, holderCounts: { ADMIN: 2, PAUSER: 0 } });
  });

  it('returns an error, never nothing, when the bytes cannot be read', () => {
    const result = bridgeStateFromBytes(bytes, AGGLAYER_PROFILE, {
      listRoleHolders: () => ({ ADMIN: ['0x1'] }),
      readIsPaused: () => {
        throw new Error('pausable slot missing');
      },
    });
    expect(result).toEqual({ status: 'error', message: "Could not read the AggLayer bridge's state: pausable slot missing" });
  });
});

describe('pauseStatus', () => {
  const ready = (paused: boolean) => ({ status: 'ready' as const, paused, holderCounts: {} });

  it('is a red PAUSED headline naming who can unpause when the bridge is paused', () => {
    expect(pauseStatus(ready(true), AGGLAYER_PROFILE)).toEqual({
      paused: true,
      headline: 'PAUSED',
      detail: 'The AggLayer bridge is paused: its operations are stopped until BRIDGE_ADMIN unpauses it.',
    });
  });

  it('names the USDCx unpauser for the faucet', () => {
    expect(pauseStatus(ready(true), USDCX_PROFILE)).toMatchObject({
      paused: true,
      headline: 'PAUSED',
      detail: 'The USDCx faucet is paused: its operations are stopped until DOM_UNPAUSER unpauses it.',
    });
  });

  it('is a quiet Running headline otherwise', () => {
    expect(pauseStatus(ready(false), AGGLAYER_PROFILE)).toEqual({
      paused: false,
      headline: 'Running',
      detail: 'The AggLayer bridge is not paused.',
    });
  });

  it('has no status while the state is unread or failed to read: never "Running" by default', () => {
    expect(pauseStatus(null, AGGLAYER_PROFILE)).toBeNull();
    expect(pauseStatus({ status: 'error', message: 'x' }, AGGLAYER_PROFILE)).toBeNull();
  });
});
