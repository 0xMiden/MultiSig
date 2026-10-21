import { describe, expect, it, vi } from 'vitest';
import {
  STORE_LOCK,
  STORE_NETWORK_KEY,
  storeResetNotice,
  STORE_VERSION_KEY,
  deleteDatabase,
  deriveStartupState,
  holdStoreLock,
  resetStoreExclusively,
  startHoldingStoreLock,
  startWithStoreCheck,
  waitForClientParts,
  type StartupState,
} from '../../src/lib/clientStartup';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), data };
}

// A minimal Web Locks model: shared holders block an exclusive ifAvailable request.
function fakeLocks() {
  let shared = 0;
  const locks = {
    request: (_name: string, options: LockOptions, callback: (lock: Lock | null) => Promise<unknown> | unknown) => {
      if (options.mode === 'exclusive') {
        return Promise.resolve(callback(options.ifAvailable && shared > 0 ? null : ({ mode: 'exclusive' } as Lock)));
      }
      shared += 1;
      return Promise.resolve(callback({ mode: 'shared' } as Lock)).finally(() => { shared -= 1; });
    },
  } as unknown as LockManager;
  return { locks, held: () => shared };
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
    const onReset = vi.fn();
    await expect(startWithStoreCheck({
      create: async () => { if (++attempts === 1) throw new Error('UpgradeError'); return 'client'; },
      reset, sdkVersion: '0.17.3', storage, onReset,
    })).resolves.toBe('client');
    expect(reset).toHaveBeenCalledTimes(1);
    expect(onReset.mock.calls[0][1]).toBe('untracked-version');
    expect(storage.data.get(STORE_VERSION_KEY)).toBe('0.17.3');
  });

  it('announces the pre-version reset that succeeded even when the retry fails to start', async () => {
    const storage = memoryStorage();
    const order: string[] = [];
    const onReset = vi.fn((_reason: string, _kind: string) => { order.push('onReset'); });
    await expect(startWithStoreCheck({
      create: async () => { order.push('create'); throw new Error('bad store'); },
      reset: async () => { order.push('reset'); },
      sdkVersion: '0.17.3', storage, onReset,
    })).rejects.toThrow(/could not start/);
    expect(order).toEqual(['create', 'reset', 'onReset', 'create']);
    expect(onReset.mock.calls[0][1]).toBe('untracked-version');
  });

  it('reports both failures when an untracked store still cannot start after the reset', async () => {
    let attempt = 0;
    await expect(startWithStoreCheck({
      create: async () => { throw new Error(++attempt === 1 ? 'first' : 'second'); },
      reset: async () => {}, sdkVersion: '0.17.3', storage: memoryStorage(),
    })).rejects.toThrow(/could not start.*second.*first/);
  });
});

describe('startWithStoreCheck: the store must belong to the network this app targets', () => {
  // A domain that moves from one network to another (admin.miden.xyz went
  // from testnet to mainnet) keeps its IndexedDB store: the SDK then sends the
  // old chain's genesis to the new node, which rejects every request.
  const TESTNET = 'https://rpc.testnet.miden.io genesis 0x280189b6';
  const MAINNET = 'https://rpc.cedar.miden.io genesis 0x059cbb01';

  it('resets a store that belongs to another network before starting', async () => {
    const storage = memoryStorage({ [STORE_VERSION_KEY]: '0.17.3', [STORE_NETWORK_KEY]: TESTNET });
    const order: string[] = [];
    const onReset = vi.fn();
    await startWithStoreCheck({
      create: async () => { order.push('create'); return 'client'; },
      reset: async () => { order.push('reset'); },
      sdkVersion: '0.17.3', network: async () => MAINNET, storage, onReset,
    });
    expect(order).toEqual(['reset', 'create']);
    expect(onReset.mock.calls[0][0]).toMatch(/belongs to another network/);
    expect(onReset.mock.calls[0][0]).toContain(TESTNET);
    expect(onReset.mock.calls[0][0]).toContain(MAINNET);
    expect(storage.data.get(STORE_NETWORK_KEY)).toBe(MAINNET);
  });

  it('does not announce a network reset that failed', async () => {
    const storage = memoryStorage({ [STORE_VERSION_KEY]: '0.17.3', [STORE_NETWORK_KEY]: TESTNET });
    const onReset = vi.fn();
    await expect(startWithStoreCheck({
      create: async () => 'client',
      reset: async () => { throw new Error('other tab'); },
      sdkVersion: '0.17.3', network: async () => MAINNET, storage, onReset,
    })).rejects.toThrow(/other tab/);
    expect(onReset).not.toHaveBeenCalled();
  });

  it('announces a network reset that succeeded even when the client then fails to start', async () => {
    const storage = memoryStorage({ [STORE_VERSION_KEY]: '0.17.3', [STORE_NETWORK_KEY]: TESTNET });
    const order: string[] = [];
    const onReset = vi.fn((_reason: string, _kind: string) => { order.push('onReset'); });
    await expect(startWithStoreCheck({
      create: async () => { order.push('create'); throw new Error('wasm'); },
      reset: async () => { order.push('reset'); },
      sdkVersion: '0.17.3', network: async () => MAINNET, storage, onReset,
    })).rejects.toThrow(/wasm/);
    expect(order).toEqual(['reset', 'onReset', 'create']);
    expect(onReset.mock.calls[0][1]).toBe('network');
  });

  it('starts without touching a store from this network', async () => {
    const storage = memoryStorage({ [STORE_VERSION_KEY]: '0.17.3', [STORE_NETWORK_KEY]: MAINNET });
    const reset = vi.fn(async () => {});
    const network = vi.fn(async () => MAINNET);
    await expect(startWithStoreCheck({
      create: async () => 'client', reset, sdkVersion: '0.17.3', network, storage,
    })).resolves.toBe('client');
    expect(network).toHaveBeenCalledTimes(1);
    expect(reset).not.toHaveBeenCalled();
  });

  it('resets once for an SDK version change and records the network, so the next start keeps the store', async () => {
    const storage = memoryStorage({ [STORE_VERSION_KEY]: '0.17.1' });
    const reset = vi.fn(async () => {});
    const start = () => startWithStoreCheck({ create: async () => 'client', reset, sdkVersion: '0.17.3', network: async () => MAINNET, storage });
    await start();
    await start();
    expect(reset).toHaveBeenCalledTimes(1);
    expect(storage.data.get(STORE_NETWORK_KEY)).toBe(MAINNET);
  });

  it('resets once when both the SDK version and the network changed, and names the network as the reason', async () => {
    const storage = memoryStorage({ [STORE_VERSION_KEY]: '0.17.1', [STORE_NETWORK_KEY]: TESTNET });
    const reset = vi.fn(async () => {});
    const onReset = vi.fn();
    const start = () => startWithStoreCheck({ create: async () => 'client', reset, sdkVersion: '0.17.3', network: async () => MAINNET, storage, onReset });
    await start();
    await start();
    expect(reset).toHaveBeenCalledTimes(1);
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(onReset.mock.calls[0][1]).toBe('network');
    expect(storage.data.get(STORE_NETWORK_KEY)).toBe(MAINNET);
  });

  it('reports an SDK version reset as one, whatever the recorded version says', async () => {
    const storage = memoryStorage({ [STORE_VERSION_KEY]: 'another network', [STORE_NETWORK_KEY]: MAINNET });
    const onReset = vi.fn();
    await startWithStoreCheck({
      create: async () => 'client', reset: async () => {}, sdkVersion: '0.17.3', network: async () => MAINNET, storage, onReset,
    });
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(onReset.mock.calls[0][1]).toBe('version');
  });

  it('keeps a store created while the node could not be asked, and records the network once it can be', async () => {
    const storage = memoryStorage();
    const reset = vi.fn(async () => {});
    await startWithStoreCheck({
      create: async () => 'client', reset, sdkVersion: '0.17.3', network: async () => { throw new Error('node unreachable'); }, storage,
    });
    await startWithStoreCheck({ create: async () => 'client', reset, sdkVersion: '0.17.3', network: async () => MAINNET, storage });
    expect(reset).not.toHaveBeenCalled();
    expect(storage.data.get(STORE_NETWORK_KEY)).toBe(MAINNET);
  });

  it('does not reset again a store it reset while the node could not be asked', async () => {
    const storage = memoryStorage({ [STORE_VERSION_KEY]: '0.17.1', [STORE_NETWORK_KEY]: TESTNET });
    const reset = vi.fn(async () => {});
    await startWithStoreCheck({
      create: async () => 'client', reset, sdkVersion: '0.17.3', network: async () => { throw new Error('node unreachable'); }, storage,
    });
    await startWithStoreCheck({ create: async () => 'client', reset, sdkVersion: '0.17.3', network: async () => MAINNET, storage });
    expect(reset).toHaveBeenCalledTimes(1);
    expect(storage.data.get(STORE_NETWORK_KEY)).toBe(MAINNET);
  });

  it('resets once a version-tracked store from before network tracking: it may be another network\'s', async () => {
    const storage = memoryStorage({ [STORE_VERSION_KEY]: '0.17.3' });
    const reset = vi.fn(async () => {});
    const onReset = vi.fn();
    await startWithStoreCheck({
      create: async () => 'client', reset, sdkVersion: '0.17.3', network: async () => MAINNET, storage, onReset,
    });
    expect(reset).toHaveBeenCalledTimes(1);
    expect(onReset.mock.calls[0][0]).toMatch(/predates network tracking/);
    expect(storage.data.get(STORE_NETWORK_KEY)).toBe(MAINNET);
  });

  it('records the network of a fresh store without resetting', async () => {
    const storage = memoryStorage();
    const reset = vi.fn(async () => {});
    await startWithStoreCheck({ create: async () => 'client', reset, sdkVersion: '0.17.3', network: async () => MAINNET, storage });
    expect(reset).not.toHaveBeenCalled();
    expect(storage.data.get(STORE_NETWORK_KEY)).toBe(MAINNET);
  });

  it('skips the network check when the node cannot be reached, and keeps the recorded network', async () => {
    const storage = memoryStorage({ [STORE_VERSION_KEY]: '0.17.3', [STORE_NETWORK_KEY]: MAINNET });
    const reset = vi.fn(async () => {});
    const network = vi.fn(async (): Promise<string> => { throw new Error('node unreachable'); });
    await expect(startWithStoreCheck({
      create: async () => 'client', reset, sdkVersion: '0.17.3', network, storage,
    })).resolves.toBe('client');
    expect(network).toHaveBeenCalledTimes(1);
    expect(reset).not.toHaveBeenCalled();
    expect(storage.data.get(STORE_NETWORK_KEY)).toBe(MAINNET);
  });

  it('stops waiting for a node that does not answer, and starts without the check', async () => {
    const storage = memoryStorage({ [STORE_VERSION_KEY]: '0.17.3', [STORE_NETWORK_KEY]: MAINNET });
    const reset = vi.fn(async () => {});
    await expect(startWithStoreCheck({
      create: async () => 'client', reset, sdkVersion: '0.17.3',
      network: () => new Promise<string>(() => {}), networkTimeoutMs: 20, storage,
    })).resolves.toBe('client');
    expect(reset).not.toHaveBeenCalled();
    expect(storage.data.get(STORE_NETWORK_KEY)).toBe(MAINNET);
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

describe('holdStoreLock (review of #31: take the shared lock before opening the store)', () => {

  it('is held once it resolves, and released only when asked', async () => {
    const { locks, held } = fakeLocks();
    const lock = await holdStoreLock(locks);
    expect(held()).toBe(1);
    await lock.release();
    expect(held()).toBe(0);
  });

  it("blocks another tab's reset while held, and lets this tab reset after releasing it", async () => {
    const { locks } = fakeLocks();
    const remove = vi.fn(async () => {});
    const lock = await holdStoreLock(locks);
    await expect(resetStoreExclusively('MidenClientDB', { locks, remove })).rejects.toThrow(/open in another tab/);
    await lock.release();
    await resetStoreExclusively('MidenClientDB', { locks, remove });
    expect(remove).toHaveBeenCalledTimes(1);
  });
});

describe('startHoldingStoreLock (re-review of #33: a failed start gives the lock up)', () => {
  const start = (locks: LockManager, storage: ReturnType<typeof memoryStorage>, create: () => Promise<string>) =>
    startHoldingStoreLock({
      create,
      reset: () => resetStoreExclusively('MidenClientDB', { locks, remove: async () => {} }),
      sdkVersion: '0.17.3',
      storage,
    }, locks);

  it('lets Retry reset once the other tab is closed', async () => {
    const { locks, held } = fakeLocks();
    const storage = memoryStorage({ [STORE_VERSION_KEY]: '0.17.1' });
    const otherTab = await holdStoreLock(locks);
    await expect(start(locks, storage, async () => 'client')).rejects.toThrow(/open in another tab/);
    expect(held()).toBe(1); // only the other tab's
    await otherTab.release();
    await expect(start(locks, storage, async () => 'client')).resolves.toBe('client');
    expect(held()).toBe(1); // ours, kept while the client runs
  });

  it('lets Retry reset again after a failed start in a single tab', async () => {
    const { locks, held } = fakeLocks();
    const storage = memoryStorage({ [STORE_VERSION_KEY]: '0.17.1' });
    await expect(start(locks, storage, async () => { throw new Error('wasm download failed'); })).rejects.toThrow('wasm download failed');
    expect(held()).toBe(0);
    await expect(start(locks, storage, async () => 'client')).resolves.toBe('client');
    expect(storage.data.get(STORE_VERSION_KEY)).toBe('0.17.3');
  });
});

describe('storeResetNotice: what the user is told after a network reset', () => {
  it('explains a reset caused by data from another network and points at the other site', () => {
    const text = storeResetNotice('network', 'mainnet', 'https://multisig-testnet.miden.xyz');
    expect(text).toContain('Miden mainnet');
    expect(text).toContain('another network');
    expect(text).toContain('https://multisig-testnet.miden.xyz');
  });

  it('treats a store from before network tracking the same way, without a link when none is configured', () => {
    const text = storeResetNotice('untracked-network', 'mainnet', '');
    expect(text).toContain('Miden mainnet');
    expect(text).not.toContain('http');
  });

  it('says nothing for a reset that has another cause', () => {
    expect(storeResetNotice('version', 'mainnet', '')).toBeNull();
    expect(storeResetNotice('untracked-version', 'mainnet', '')).toBeNull();
  });
});
