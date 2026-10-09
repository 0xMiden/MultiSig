import { describe, it, expect } from 'vitest';
import { bridgeStateFromBytes } from '@/lib/admin/bridgeState';
import { AGGLAYER_PROFILE } from '@/lib/admin/target';

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
