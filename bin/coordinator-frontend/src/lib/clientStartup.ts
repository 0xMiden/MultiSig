import { formatError } from '@/lib/errors';

/**
 * Starts the Miden client; if that fails, resets its local store once and
 * tries again. The store is a local cache of chain data, rebuilt on sync. A
 * store left by an older SDK (e.g. a previous deployment on the same domain)
 * can stop the current SDK from starting at all. Signer keys live in a
 * separate database and are not touched.
 */
export async function startWithStoreReset<T>(
  create: () => Promise<T>,
  resetStore: () => Promise<void>,
  onReset?: (error: unknown) => void,
): Promise<T> {
  try {
    return await create();
  } catch (first) {
    onReset?.(first);
    await resetStore();
    try {
      return await create();
    } catch (second) {
      throw new Error(
        `The Miden client could not start, even after resetting its local data: ${formatError(second)}` +
        ` (first attempt: ${formatError(first)})`,
      );
    }
  }
}

/**
 * Deletes an IndexedDB database. Resolves once it is gone, or after
 * `blockedTimeoutMs` if another open connection (e.g. a second tab) blocks it,
 * so start-up never hangs on the reset itself.
 */
export function deleteDatabase(name: string, blockedTimeoutMs = 5_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    const timer = setTimeout(resolve, blockedTimeoutMs);
    request.onsuccess = () => { clearTimeout(timer); resolve(); };
    request.onerror = () => { clearTimeout(timer); reject(request.error); };
    request.onblocked = () => { /* wait for the other connection to close, up to the timeout */ };
  });
}

export interface ClientParts<M, C> {
  midenClient: M;
  multisigClient: C;
  guardianCommitment: string;
}

export type StartupState = { phase: 'starting' } | { phase: 'ready' } | { phase: 'error'; error: string };

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
