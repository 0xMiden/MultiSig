import {
  GuardianSessionsUnsupportedError,
  IndexedDbSessionKeyStore,
  SessionGrantDeclinedError,
  describeSessionGrant,
  resumeGuardianSession,
  startGuardianSession,
  type GuardianSession,
  type SessionKeyStore,
} from '@openzeppelin/miden-multisig-client';
import {
  GuardianHttpError,
  type GuardianHttpClient,
  type SessionEndReason,
  type SessionGrantFields,
  type Signer,
} from '@openzeppelin/guardian-client';
import type { WalletSource } from '@/wallets/types';
import { formatError } from './errors';

/**
 * Guardian sessions (Guardian 0.18.1). The wallet signs one grant, then a
 * non-extractable browser key signs Guardian's reads and its proposal list,
 * get, create and sign requests until the grant expires (Guardian's maximum,
 * 8 h, less a minute), so they stop prompting. Approving a transaction,
 * executing it, unlocking, registration and lookup still go to the wallet.
 *
 * Guardian grants sessions only to a cosigner of some account, so the app asks
 * for one when it loads an account the wallet cosigns (before the load's own
 * requests, which then need no wallet) and right after creating one. A reload
 * resumes the stored key without a prompt. The key is kept in IndexedDB.
 */
export type GuardianSessionState =
  | { phase: 'off' }
  | { phase: 'resuming' }
  | { phase: 'starting' }
  | { phase: 'active'; expiresAt: number }
  | { phase: 'ended'; reason: SessionEndReason }
  | { phase: 'failed'; message: string }
  | { phase: 'unsupported' };

/** Local keys sign without prompting, so only external wallets use sessions. */
export function walletUsesSessions(source: WalletSource): boolean {
  return source !== 'local';
}

const SESSION_DB = 'miden-multisig-guardian-sessions';

let store: SessionKeyStore | undefined;
export function sessionKeyStore(): SessionKeyStore {
  return (store ??= new IndexedDbSessionKeyStore(SESSION_DB));
}

/**
 * Deletes every stored session key of this site (logout): a key that is not
 * stored can no longer sign once the page reloads, whatever Guardian says.
 */
export function forgetAllSessionKeys(idb: IDBFactory | undefined = globalThis.indexedDB): Promise<void> {
  return new Promise((resolve) => {
    if (!idb) return resolve();
    const open = idb.open(SESSION_DB);
    open.onerror = () => resolve();
    open.onsuccess = () => {
      const db = open.result;
      const names = [...db.objectStoreNames];
      if (names.length === 0) { db.close(); return resolve(); }
      const transaction = db.transaction(names, 'readwrite');
      for (const name of names) transaction.objectStore(name).clear();
      transaction.oncomplete = transaction.onerror = transaction.onabort = () => { db.close(); resolve(); };
    };
  });
}

/** What the confirm dialog shows for a grant. */
export function sessionGrantRows(grant: SessionGrantFields): Array<{ label: string; value: string }> {
  return describeSessionGrant(grant);
}

/**
 * Guardian errors that mean the session used for a request is no longer
 * accepted. The client then stops using it, but that request has failed:
 * running it again signs with the wallet.
 */
export function sessionDied(error: unknown): boolean {
  return error instanceof GuardianHttpError
    && ['session_expired', 'session_revoked', 'authentication_failed'].includes(error.code ?? '');
}

/**
 * Runs a Guardian request once more when it found the session dead: the
 * client stopped using the session, so the second run signs with the wallet
 * instead of failing the user's action.
 */
export async function retryIfSessionDied<T>(request: () => Promise<T>): Promise<T> {
  try {
    return await request();
  } catch (error) {
    if (!sessionDied(error)) throw error;
    return request();
  }
}

function failure(error: unknown): GuardianSessionState {
  if (error instanceof GuardianSessionsUnsupportedError) return { phase: 'unsupported' };
  if (error instanceof SessionGrantDeclinedError) {
    return { phase: 'failed', message: 'Session declined: Guardian requests ask the wallet each time.' };
  }
  if (error instanceof GuardianHttpError && error.status === 403) {
    return { phase: 'failed', message: 'Guardian does not list this wallet as a cosigner of any account yet.' };
  }
  return { phase: 'failed', message: formatError(error, 'Could not start a Guardian session') };
}

type Start = typeof startGuardianSession;
type Resume = typeof resumeGuardianSession;

export interface SessionManagerDeps {
  /** Shows the grant before the wallet signs it. Used for every wallet: with Ledger's blind signing the device shows only a hash. */
  confirm: (grant: SessionGrantFields) => Promise<boolean>;
  /** Closes a confirmation that is still open (answers "no"). */
  cancelConfirm: () => void;
  onState: (state: GuardianSessionState) => void;
  store?: () => SessionKeyStore;
  start?: Start;
  resume?: Resume;
  now?: () => number;
}

/**
 * The tab's Guardian sessions for the connected wallet. A session may be set
 * on several Guardian clients (the MultisigClient's, and an account's own when
 * that is another object); all of them end together. Every operation checks,
 * after each await, that the wallet has not changed meanwhile: a session that
 * arrives for a superseded wallet is revoked at once instead of being kept.
 */
export class GuardianSessionManager {
  private wallet: string | null = null;
  private generation = 0;
  private readonly sessions = new Map<GuardianHttpClient, GuardianSession>();
  private readonly pending = new Map<GuardianHttpClient, Promise<void>>();
  private expiryTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly store: () => SessionKeyStore;
  private readonly start: Start;
  private readonly resumeOn: Resume;
  private readonly now: () => number;

  constructor(private readonly deps: SessionManagerDeps) {
    this.store = deps.store ?? sessionKeyStore;
    this.start = deps.start ?? startGuardianSession;
    this.resumeOn = deps.resume ?? resumeGuardianSession;
    this.now = deps.now ?? Date.now;
  }

  /** Sessions belong to one wallet on one Guardian (`source|commitment|url`); another ends them. */
  async setWallet(key: string | null): Promise<void> {
    if (key === this.wallet) return;
    this.wallet = key;
    await this.endAll();
  }

  get walletKey(): string | null {
    return this.wallet;
  }

  holds(guardian: GuardianHttpClient): boolean {
    return this.sessions.has(guardian);
  }

  /** Puts the stored session on `guardian`, without a prompt. */
  resume(guardian: GuardianHttpClient, signer: Signer): Promise<void> {
    return this.once(guardian, () => this.open(guardian, signer, false));
  }

  /** Resumes the stored session on `guardian`, or starts one: one wallet approval. */
  ensure(guardian: GuardianHttpClient, signer: Signer): Promise<void> {
    return this.once(guardian, () => this.open(guardian, signer, true));
  }

  /**
   * Ends every session this tab holds: the stored keys are deleted first (a
   * revoke that fails or is cut short by a reload must not leave a usable
   * key), then each is revoked on Guardian. A start still in flight is
   * cancelled, and a pending confirmation closed.
   */
  async endAll(): Promise<void> {
    this.generation += 1;
    clearTimeout(this.expiryTimer);
    this.deps.cancelConfirm();
    const held = [...this.sessions.entries()];
    this.sessions.clear();
    this.pending.clear();
    this.deps.onState({ phase: 'off' });
    await Promise.all(held.map(([, session]) => this.store().remove(session.storeId, session.publicKey).catch(() => {})));
    await Promise.all(held.map(([guardian, session]) => this.revoke(guardian, session)));
  }

  private once(guardian: GuardianHttpClient, run: () => Promise<void>): Promise<void> {
    if (this.sessions.has(guardian)) return Promise.resolve();
    const running = this.pending.get(guardian);
    if (running) return running;
    const task = run().finally(() => {
      if (this.pending.get(guardian) === task) this.pending.delete(guardian);
    });
    this.pending.set(guardian, task);
    return task;
  }

  private async open(guardian: GuardianHttpClient, signer: Signer, prompt: boolean): Promise<void> {
    const generation = this.generation;
    const current = () => generation === this.generation;
    const onEnded = (reason: SessionEndReason, session: GuardianSession) => this.ended(guardian, session, reason);
    if (this.sessions.size === 0) this.deps.onState({ phase: 'resuming' });
    let session: GuardianSession | null = null;
    try {
      session = await this.resumeOn(guardian, signer, this.store(), { onEnded });
      if (!session && prompt && current()) {
        this.deps.onState({ phase: 'starting' });
        session = await this.start(guardian, signer, { store: this.store(), confirm: this.deps.confirm, onEnded });
      }
    } catch (error) {
      if (current()) this.deps.onState(failure(error));
      return;
    }
    if (!current()) {
      // The wallet changed (or logout) while this ran: never keep it.
      if (session) {
        await this.store().remove(session.storeId, session.publicKey).catch(() => {});
        await this.revoke(guardian, session);
      }
      return;
    }
    if (session) this.sessions.set(guardian, session);
    this.report();
  }

  private ended(guardian: GuardianHttpClient, session: GuardianSession, reason: SessionEndReason): void {
    if (this.sessions.get(guardian) !== session) return;
    this.sessions.delete(guardian);
    if (reason !== 'logout' && this.sessions.size === 0) {
      clearTimeout(this.expiryTimer);
      this.deps.onState({ phase: 'ended', reason });
    }
  }

  /** The state of the sessions held now, with a timer for their expiry. */
  private report(): void {
    clearTimeout(this.expiryTimer);
    const expiresAt = Math.min(...[...this.sessions.values()].map((session) => session.expiresAt));
    if (!Number.isFinite(expiresAt)) {
      this.deps.onState({ phase: 'off' });
      return;
    }
    this.deps.onState({ phase: 'active', expiresAt });
    const generation = this.generation;
    this.expiryTimer = setTimeout(() => {
      if (generation !== this.generation) return;
      // Guardian's client would notice only on its next request.
      for (const [guardian, session] of [...this.sessions]) {
        stopUsing(guardian, session);
        this.ended(guardian, session, 'expired');
      }
    }, Math.max(0, expiresAt * 1000 - this.now()));
  }

  private async revoke(guardian: GuardianHttpClient, session: GuardianSession): Promise<void> {
    try {
      await guardian.revokeSession(session);
    } catch {
      // Unreachable Guardian: stop using it here; the stored key is already gone.
      stopUsing(guardian, session);
    }
  }
}

function stopUsing(guardian: GuardianHttpClient, session: GuardianSession): void {
  if (guardian.getSession() === session) guardian.setSession(null);
}

/** The endpoint a Guardian client talks to (kept private by the client). */
export function guardianEndpoint(guardian: GuardianHttpClient): string {
  return (guardian as unknown as { baseUrl: string }).baseUrl;
}
