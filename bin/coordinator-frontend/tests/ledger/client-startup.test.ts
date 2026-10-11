import { describe, expect, it, vi } from 'vitest';
import {
  STORE_LOCK,
  STORE_VERSION_KEY,
  deleteDatabase,
  deriveStartupState,
  resetStoreExclusively,
  startWithStoreCheck,
  waitForClientParts,
  type StartupState,
} from '../../src/lib/clientStartup';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), data };
}

describe('startWithStoreCheck (review 10: reset only on an SDK version change)', () => {
  it('starts without touching a store this SDK version wrote, and keeps the marker', async () => {
    const storage = memoryStorage({ [STORE_VERSION_KEY]: '0.17.3' });
    const reset = vi.fn(async () => {});
    await expect(startWithStoreCheck({ create: async () => 'client', reset, sdkVersion: '0.17.3', storage })).resolves.toBe('client');
    expect(reset).not.toHaveBeenCalled();
    expect(storage.data.get(STORE_VERSION_KEY)).toBe('0.17.3');
  });

  it('resets a store written by another SDK version before starting', async () => {
    const storage = memoryStorage({ [STORE_VERSION_KEY]: '0.17.1' });
    const order: string[] = [];
    const onReset = vi.fn();
    await startWithStoreCheck({
      create: async () => { order.push('create'); return 'client'; },
      reset: async () => { order.push('reset'); },
      sdkVersion: '0.17.3', storage, onReset,
    });
    expect(order).toEqual(['reset', 'create']);
    expect(onReset.mock.calls[0][0]).toMatch(/written by Miden SDK 0\.17\.1; this app runs 0\.17\.3/);
    expect(storage.data.get(STORE_VERSION_KEY)).toBe('0.17.3');
  });

  it('never wipes a same-version store on a start failure: reports it instead', async () => {
    const storage = memoryStorage({ [STORE_VERSION_KEY]: '0.17.3' });
    const reset = vi.fn(async () => {});
    await expect(startWithStoreCheck({
      create: async () => { throw new Error('transient IndexedDB error'); }, reset, sdkVersion: '0.17.3', storage,
    })).rejects.toThrow('transient IndexedDB error');
    expect(reset).not.toHaveBeenCalled();
  });

  it('resets once a store from before version tracking that fails to start', async () => {
    const storage = memoryStorage();
    let attempts = 0;
    const reset = vi.fn(async () => {});
    await expect(startWithStoreCheck({
      create: async () => { if (++attempts === 1) throw new Error('UpgradeError'); return 'client'; },
      reset, sdkVersion: '0.17.3', storage,
    })).resolves.toBe('client');
    expect(reset).toHaveBeenCalledTimes(1);
    expect(storage.data.get(STORE_VERSION_KEY)).toBe('0.17.3');
  });

  it('reports both failures when an untracked store still cannot start after the reset', async () => {
    let attempt = 0;
    await expect(startWithStoreCheck({
      create: async () => { throw new Error(++attempt === 1 ? 'first' : 'second'); },
      reset: async () => {}, sdkVersion: '0.17.3', storage: memoryStorage(),
    })).rejects.toThrow(/could not start.*second.*first/);
  });
});

describe('store reset across tabs (review 6)', () => {
  it('fails at once when another connection blocks the delete, instead of resolving early', async () => {
    const request: { onsuccess?: () => void; onerror?: () => void; onblocked?: () => void; error?: unknown } = {};
    const idb = { deleteDatabase: () => { queueMicrotask(() => request.onblocked?.()); return request as unknown as IDBOpenDBRequest; } };
    await expect(deleteDatabase('MidenClientDB', idb)).rejects.toThrow(/open in another tab/);
  });

  it('does not delete while another tab holds the store lock', async () => {
    const remove = vi.fn(async () => {});
    const locks = {
      request: async (name: string, options: LockOptions, callback: (lock: Lock | null) => Promise<unknown>) => {
        expect(name).toBe(STORE_LOCK);
        expect(options).toEqual({ mode: 'exclusive', ifAvailable: true });
        return callback(null); // held in shared mode by another tab
      },
    } as unknown as LockManager;
    await expect(resetStoreExclusively('MidenClientDB', { locks, remove })).rejects.toThrow(/open in another tab/);
    expect(remove).not.toHaveBeenCalled();
  });

  it('deletes while holding the lock exclusively when no other tab has the store', async () => {
    const remove = vi.fn(async () => {});
    const locks = { request: async (_n: string, _o: LockOptions, cb: (lock: Lock | null) => Promise<unknown>) => cb({ name: STORE_LOCK, mode: 'exclusive' } as Lock) } as unknown as LockManager;
    await resetStoreExclusively('MidenClientDB', { locks, remove });
    expect(remove).toHaveBeenCalledWith('MidenClientDB');
  });
});

describe('deriveStartupState (review 1, 3, 10)', () => {
  const base = { ready: false, building: false, error: null, guardianFailed: false };

  it('is ready as soon as the client parts exist, even after an earlier start-up error (a later reconnect)', () => {
    expect(deriveStartupState({ ...base, ready: true, error: 'Failed to connect to Guardian' })).toEqual({ phase: 'ready' });
  });

  it('reports a failed Guardian connection at once instead of waiting', () => {
    expect(deriveStartupState({ ...base, guardianFailed: true })).toEqual({
      phase: 'error', error: 'Not connected to Guardian. Check the endpoint and try again.',
    });
  });

  it('is starting while a build runs, and an error once it failed', () => {
    expect(deriveStartupState({ ...base, building: true, error: 'old' })).toEqual({ phase: 'starting' });
    expect(deriveStartupState({ ...base, error: 'boom' })).toEqual({ phase: 'error', error: 'boom' });
  });
});

describe('waitForClientParts', () => {
  const parts = { midenClient: 'miden', multisigClient: 'multisig', guardianCommitment: '0xabc' };
  const sleep = async () => {};

  it('returns the parts as soon as the client is ready, instead of failing early clicks', async () => {
    let checks = 0;
    const current = () => (++checks >= 3 ? parts : null);
    await expect(waitForClientParts(current, () => ({ phase: 'starting' }), { sleep })).resolves.toEqual(parts);
    expect(checks).toBe(3);
  });

  it('fails with the real start-up error', async () => {
    const failed: StartupState = { phase: 'error', error: 'The Miden client could not start: boom' };
    await expect(waitForClientParts(() => null, () => failed, { sleep })).rejects.toThrow('could not start: boom');
  });

  it('gives up after the timeout with a clear message', async () => {
    await expect(waitForClientParts(() => null, () => ({ phase: 'starting' }), { sleep, timeoutMs: 1_000, pollMs: 200 }))
      .rejects.toThrow('still starting');
  });
});
