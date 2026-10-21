import { formatError } from '@/lib/errors';

/** localStorage key recording the SDK version that wrote the local store. */
export const STORE_VERSION_KEY = 'midenStoreSdkVersion';
/** localStorage key recording the network (node URL and genesis) the local store belongs to. */
export const STORE_NETWORK_KEY = 'midenStoreNetwork';
/**
 * STORE_NETWORK_KEY of a store this app created or reset while the node could
 * not be asked: it belongs to the network this app targets, so the next start
 * that reaches the node records that network instead of resetting the store.
 */
const NETWORK_UNCONFIRMED = 'unconfirmed';
/** How long a start waits for the node to name its network before skipping the check. */
const NETWORK_CHECK_TIMEOUT_MS = 10_000;
/** Why the store was reset. The notice is chosen from this, never from the reason text. */
export type StoreResetKind = 'network' | 'version' | 'untracked-network' | 'untracked-version';
/**
 * Web Lock every running tab holds in shared mode once its client has
 * started. A store reset takes it exclusively, so it can never delete a store
 * another tab has open.
 */
export const STORE_LOCK = 'miden-multisig-store';

export interface StoreStartOptions<T> {
  create: () => Promise<T>;
  /** Deletes the local store; must fail rather than wait when another tab has it open. */
  reset: () => Promise<void>;
  /** The SDK version running now. */
  sdkVersion: string;
  /**
   * The network this app targets, as one string (node URL and genesis
   * commitment). A failure, or no answer within `networkTimeoutMs`, skips the
   * network check for this start.
   */
  network?: () => Promise<string>;
  networkTimeoutMs?: number;
  storage?: Pick<Storage, 'getItem' | 'setItem'>;
  onReset?: (reason: string, kind: StoreResetKind) => void;
}

/**
 * Starts the Miden client on its local store. The store is reset only when it
 * was written by another SDK version, or belongs to another network: a store
 * left by an older SDK can stop the current one from starting, and a store
 * from another chain (a domain that moved networks keeps its IndexedDB) makes
 * the SDK send that chain's genesis, which the node rejects on every request.
 * A start failure with the same version is reported, never "fixed" by wiping
 * the store (which holds private-note history). A store from before versions
 * or networks were recorded is reset once, as before. A start resets at most
 * once before opening the store, and leaves both markers describing the store
 * it opened. Signer keys live in a separate database and are not touched.
 */
export async function startWithStoreCheck<T>({
  create,
  reset,
  sdkVersion,
  network,
  networkTimeoutMs = NETWORK_CHECK_TIMEOUT_MS,
  storage = globalThis.localStorage,
  onReset,
}: StoreStartOptions<T>): Promise<T> {
  const recorded = readStorage(storage, STORE_VERSION_KEY);
  const target = network ? await withinDeadline(network(), networkTimeoutMs).catch(() => null) : null;
  const stored = readStorage(storage, STORE_NETWORK_KEY);
  const known = stored && stored !== NETWORK_UNCONFIRMED ? stored : null;
  // One decision and at most one reset. Another network is the better
  // explanation when the SDK version changed as well.
  const stale: [string, StoreResetKind] | null =
    target && known && known !== target ? [`the local data belongs to another network (${known}); this app targets ${target}`, 'network']
    : recorded && recorded !== sdkVersion ? [`the local data was written by Miden SDK ${recorded}; this app runs ${sdkVersion}`, 'version']
    : target && !stored && recorded ? [`the local data predates network tracking and may belong to another network; this app targets ${target}`, 'untracked-network']
    : null;
  if (stale) {
    // Announce only after the delete. A rejected reset must not claim the data was cleared.
    await reset();
    onReset?.(...stale);
  }
  // A new or just-reset store belongs to the network this app targets, even
  // when the node could not say which one that is. Re-read the markers: a
  // failed probe must not overwrite a network another start confirmed while
  // this one was waiting.
  if (target) writeStorage(storage, STORE_NETWORK_KEY, target);
  else if (network && stale) writeStorage(storage, STORE_NETWORK_KEY, NETWORK_UNCONFIRMED);
  else if (network && !readStorage(storage, STORE_VERSION_KEY)) {
    const current = readStorage(storage, STORE_NETWORK_KEY);
    if (!current || current === NETWORK_UNCONFIRMED) writeStorage(storage, STORE_NETWORK_KEY, NETWORK_UNCONFIRMED);
  }
  let client: T;
  try {
    client = await create();
  } catch (first) {
    if (recorded) throw first;
    await reset();
    onReset?.(`the local data predates version tracking and the client failed to start: ${formatError(first)}`, 'untracked-version');
    // The store just cleared belongs to this app's network, which the probe
    // could not name. Keep a marker another start confirmed during the reset.
    if (network && !target) {
      const current = readStorage(storage, STORE_NETWORK_KEY);
      if (!current || current === NETWORK_UNCONFIRMED || current === stored) {
        writeStorage(storage, STORE_NETWORK_KEY, NETWORK_UNCONFIRMED);
      }
    }
    try {
      client = await create();
    } catch (second) {
      throw new Error(
        `The Miden client could not start, even after resetting its local data: ${formatError(second)}` +
        ` (first attempt: ${formatError(first)})`,
      );
    }
  }
  writeStorage(storage, STORE_VERSION_KEY, sdkVersion);
  return client;
}

function withinDeadline<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`no answer within ${ms} ms`)), ms);
  });
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
}

function readStorage(storage: StoreStartOptions<unknown>['storage'], key: string): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writeStorage(storage: StoreStartOptions<unknown>['storage'], key: string, value: string): void {
  try {
    storage?.setItem(key, value);
  } catch {
    /* storage unavailable: the next start treats the store as untracked */
  }
}

/**
 * Deletes an IndexedDB database. Fails as soon as another open connection
 * (another tab) blocks the delete, instead of waiting or resolving early.
 */
export function deleteDatabase(name: string, idb: Pick<IDBFactory, 'deleteDatabase'> = indexedDB): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = idb.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error(OTHER_TAB_OPEN));
  });
}

const OTHER_TAB_OPEN = 'This app is open in another tab, which is using its local data. Close the other tabs, then retry.';

/**
 * Resets the store only while no other tab holds it (see STORE_LOCK). Without
 * Web Locks (none of the browsers this app supports: Chrome 69+, Edge 79+,
 * Firefox 96+, Safari 15.4+) it falls back to the plain delete. Do not rely on
 * that fallback: a blocked delete fails here, but IndexedDB still runs it once
 * the other tab closes its connection.
 */
export async function resetStoreExclusively(
  name: string,
  { locks = globalThis.navigator?.locks, remove = deleteDatabase }: { locks?: LockManager; remove?: (name: string) => Promise<void> } = {},
): Promise<void> {
  if (!locks) return remove(name);
  const done = await locks.request(STORE_LOCK, { mode: 'exclusive', ifAvailable: true }, async (lock) => {
    if (!lock) return false;
    await remove(name);
    return true;
  });
  if (!done) throw new Error(OTHER_TAB_OPEN);
}

export interface StoreLock {
  /**
   * Gives the lock up, e.g. so this tab can take it exclusively for its own
   * reset. Resolves once the browser has actually released it.
   */
  release(): Promise<void>;
}

/**
 * Takes STORE_LOCK in shared mode and holds it until released (or the tab
 * closes). Resolves once granted, so it can be taken before the client opens
 * the store: another tab's reset then cannot run while this one starts.
 */
export async function holdStoreLock(locks: LockManager | undefined = globalThis.navigator?.locks): Promise<StoreLock> {
  if (!locks) return { release: async () => {} };
  let unhold!: () => void;
  const held = new Promise<void>((resolve) => { unhold = resolve; });
  let released!: Promise<unknown>;
  await new Promise<void>((granted) => {
    // request() settles only after the callback's promise does and the lock is freed.
    released = locks.request(STORE_LOCK, { mode: 'shared' }, () => {
      granted();
      return held;
    });
  });
  return {
    release: async () => {
      unhold();
      await released;
    },
  };
}

/**
 * Starts the client (startWithStoreCheck) holding STORE_LOCK in shared mode,
 * taken before the store is opened and kept once started. This tab gives it up
 * only for its own reset (`reset` takes the lock exclusively), and after a
 * failed start: kept then, it would block this tab's own reset on every Retry
 * as if another tab had the store open.
 */
export async function startHoldingStoreLock<T>(
  options: StoreStartOptions<T>,
  locks: LockManager | undefined = globalThis.navigator?.locks,
): Promise<T> {
  let lock = await holdStoreLock(locks);
  try {
    return await startWithStoreCheck({
      ...options,
      reset: async () => {
        await lock.release();
        try {
          await options.reset();
        } finally {
          lock = await holdStoreLock(locks);
        }
      },
    });
  } catch (error) {
    await lock.release();
    throw error;
  }
}

export interface ClientParts<M, C> {
  midenClient: M;
  multisigClient: C;
  guardianCommitment: string;
}

export type StartupState = { phase: 'starting' } | { phase: 'ready' } | { phase: 'error'; error: string };

/**
 * Start-up state, derived from what exists instead of tracked separately:
 * ready as soon as the client parts are all there (also after a later Guardian
 * reconnect), and a failed Guardian connection is an error at once rather
 * than a wait.
 */
export function deriveStartupState({ ready, building, error, guardianFailed }: {
  ready: boolean;
  building: boolean;
  error: string | null;
  guardianFailed: boolean;
}): StartupState {
  if (ready) return { phase: 'ready' };
  if (building) return { phase: 'starting' };
  if (error) return { phase: 'error', error };
  if (guardianFailed) return { phase: 'error', error: 'Not connected to Guardian. Check the endpoint and try again.' };
  return { phase: 'starting' };
}

/**
 * Waits until the client is ready and returns its current parts, instead of
 * failing a click that came in while it was still starting. Fails with the
 * real start-up error if start-up failed, or after `timeoutMs`.
 */
export async function waitForClientParts<M, C>(
  current: () => ClientParts<M, C> | null,
  startup: () => StartupState,
  { timeoutMs = 120_000, pollMs = 200, sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms)) } = {},
): Promise<ClientParts<M, C>> {
  for (let waited = 0; ; waited += pollMs) {
    const parts = current();
    if (parts) return parts;
    const state = startup();
    if (state.phase === 'error') throw new Error(state.error);
    if (waited >= timeoutMs) throw new Error('The Miden client is still starting. Please try again in a moment.');
    await sleep(pollMs);
  }
}

/**
 * A misconfigured deployment (missing or invalid network env) must fail with
 * the reason, before any start attempt: it is not a stale local store, so it
 * must not trigger the store reset above.
 */
export function assertConfigured(errors: readonly string[]): void {
  if (errors.length > 0) {
    throw new Error(`This deployment is misconfigured: ${errors.join(' ')}`);
  }
}

/**
 * What to tell the user after `startWithStoreCheck` reset the store because it
 * belonged to another network (or predated network tracking). `null` for any
 * other kind of reset. The reason's node URLs and genesis commitments are not
 * repeated: the user needs to know what happened and where their other
 * network's accounts are reached, not the chain identifiers.
 */
export function storeResetNotice(kind: StoreResetKind, network: string, otherNetworkAppUrl: string): string | null {
  if (kind !== 'network' && kind !== 'untracked-network') return null;
  const base = `This site now serves Miden ${network}, so local data left here by another network was cleared. The accounts themselves are untouched.`;
  return otherNetworkAppUrl ? `${base} Multisigs on other networks: ${otherNetworkAppUrl}` : base;
}
