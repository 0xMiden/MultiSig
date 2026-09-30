import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SignerInfo } from '../../src/types/psm';

// A stand-in for the browser-held keys; the refusals below must happen before
// they are ever touched.
const localKeys = new Proxy({}, { get: () => { throw new Error('local keys were read'); } }) as SignerInfo;

async function loadCreateSigner(localKeysEnabled: boolean) {
  vi.resetModules();
  vi.doMock('../../src/config/psm', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../src/config/psm')>()),
    LOCAL_KEYS_ENABLED: localKeysEnabled,
  }));
  return (await import('../../src/lib/multisigApi')).createSigner;
}

describe('createSigner (review finding 6)', () => {
  afterEach(() => { vi.doUnmock('../../src/config/psm'); });

  it('never falls back to a browser key in production builds', async () => {
    const createSigner = await loadCreateSigner(false);
    expect(() => createSigner(localKeys, 'falcon')).toThrow('Connect a wallet (Ledger, Para or the Miden Wallet) first.');
    expect(() => createSigner(null, 'ecdsa', undefined)).toThrow('Connect a wallet');
  });

  it('still refuses a Ledger source without a selected Ledger account', async () => {
    const createSigner = await loadCreateSigner(false);
    expect(() => createSigner(localKeys, 'ecdsa', { walletSource: 'ledger' })).toThrow('Connect and select a Ledger account first');
  });

  it('reports local keys that are not generated yet in development builds', async () => {
    const createSigner = await loadCreateSigner(true);
    expect(() => createSigner(null, 'falcon')).toThrow('Local keys are still being generated');
  });
});
