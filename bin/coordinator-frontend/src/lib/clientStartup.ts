import { formatError } from '@/lib/errors';

/** localStorage key recording the SDK version that wrote the local store. */
export const STORE_VERSION_KEY = 'midenStoreSdkVersion';
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
  storage?: Pick<Storage, 'getItem' | 'setItem'>;
  onReset?: (reason: string) => void;
}

/**
 * Starts the Miden client on its local store. The store is reset only when it
 * was written by another SDK version: a store left by an older SDK can stop
 * the current one from starting. A start failure with the same version is
 * reported, never "fixed" by wiping the store (which holds private-note
 * history). A store from before versions were recorded is reset once, as
 * before. Signer keys live in a separate database and are not touched.
 */
export async function startWithStoreCheck<T>({
  create,
  reset,
  sdkVersion,
  storage = globalThis.localStorage,
  onReset,
}: StoreStartOptions<T>): Promise<T> {
  const recorded = readStorage(storage, STORE_VERSION_KEY);
  if (recorded && recorded !== sdkVersion) {
    onReset?.(`the local data was written by Miden SDK ${recorded}; this app runs ${sdkVersion}`);
    await reset();
  }
  let client: T;
  try {
    client = await create();
  } catch (first) {
    if (recorded) throw first;
    onReset?.(`the local data predates version tracking and the client failed to start: ${formatError(first)}`);
    await reset();
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
 * Web Locks it falls back to the plain delete, which still fails when blocked.
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

/** Holds STORE_LOCK in shared mode for the life of this tab. */
export function holdStoreLock(locks: LockManager | undefined = globalThis.navigator?.locks): void {
  void locks?.request(STORE_LOCK, { mode: 'shared' }, () => new Promise<void>(() => {}));
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
