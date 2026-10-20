import { describe, expect, it, vi } from 'vitest';
import type { Account } from '@miden-sdk/miden-sdk';
import { fetchFaucetAccount, type FaucetAccountClient } from '@/lib/admin/faucetAccount';

const FAUCET = '0x4cbdcaffe75f0a317482224dae6436';

function fakeAccount(label: string): Account {
  return { label } as unknown as Account;
}

function fakeClient(overrides: Partial<FaucetAccountClient['accounts']> & { sync?: () => Promise<unknown> }) {
  const accounts = {
    get: vi.fn(async () => null as Account | null),
    import: vi.fn(async () => fakeAccount('imported')),
    ...overrides,
  };
  const sync = vi.fn(overrides.sync ?? (async () => undefined));
  return { client: { accounts, sync } satisfies FaucetAccountClient, accounts, sync };
}

describe('fetchFaucetAccount', () => {
  it('imports the faucet through the client when the local store does not track it', async () => {
    // The node flags any storage map over its per-response limit; the client's import path fills
    // such maps in via SyncAccountStorageMaps, which `RpcClient.getAccountDetails` does not.
    const { client, accounts, sync } = fakeClient({});

    const account = await fetchFaucetAccount(client, FAUCET);

    expect(accounts.import).toHaveBeenCalledWith(FAUCET);
    expect(account).toEqual(fakeAccount('imported'));
    expect(sync).not.toHaveBeenCalled();
  });

  it('syncs before reading a faucet the local store already tracks', async () => {
    const copies = [fakeAccount('stale'), fakeAccount('fresh')];
    const { client, accounts, sync } = fakeClient({ get: vi.fn(async () => copies.shift() ?? null) });

    const account = await fetchFaucetAccount(client, FAUCET);

    expect(sync).toHaveBeenCalledTimes(1);
    expect(accounts.import).not.toHaveBeenCalled();
    expect(account).toEqual(fakeAccount('fresh'));
  });

  it('still returns the local copy when the sync fails', async () => {
    const { client } = fakeClient({
      get: vi.fn(async () => fakeAccount('local')),
      sync: async () => {
        throw new Error('node unreachable');
      },
    });

    await expect(fetchFaucetAccount(client, FAUCET)).resolves.toEqual(fakeAccount('local'));
  });

  it('propagates the import error when the faucet is neither tracked nor fetchable', async () => {
    const { client } = fakeClient({
      import: vi.fn(async () => {
        throw new Error('account not found on the node');
      }),
    });

    await expect(fetchFaucetAccount(client, FAUCET)).rejects.toThrow('account not found on the node');
  });
});
