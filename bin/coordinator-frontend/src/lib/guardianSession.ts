import {
  GuardianSessionsUnsupportedError,
  IndexedDbSessionKeyStore,
  SessionGrantDeclinedError,
  describeSessionGrant,
  endGuardianSession,
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
 * Guardian sessions (Guardian 0.18.1). Connecting a wallet starts one: the
 * wallet signs one grant, then a non-extractable browser key signs Guardian's
 * reads and its proposal list, get, create and sign requests until the grant
 * expires (Guardian's maximum, 8 h), so they stop prompting. Transaction
 * approvals, execute pushes, unlock, registration and lookup still go to the
 * wallet. The key is kept in IndexedDB, so a reload resumes the session.
 *
 * Guardian grants sessions only to a cosigner of some account: a wallet with no
 * account yet ('waiting') gets its session once its first account is on Guardian.
 */
export type GuardianSessionState =
  | { phase: 'off' }
  | { phase: 'starting' }
  | { phase: 'waiting' }
  | { phase: 'active'; expiresAt: number }
  | { phase: 'ended'; reason: SessionEndReason }
  | { phase: 'failed'; message: string }
  | { phase: 'unsupported' };

/** Local keys sign without prompting, so only external wallets need a session. */
export function walletUsesSessions(source: WalletSource): boolean {
  return source !== 'local';
}

let store: SessionKeyStore | undefined;
export function sessionKeyStore(): SessionKeyStore {
  return (store ??= new IndexedDbSessionKeyStore('miden-multisig-guardian-sessions'));
}

/**
 * Session operations on one Guardian client. The app signs its requests with
 * the account's own client (the Multisig's), which is not always the
 * MultisigClient's, so sessions are set on that one.
 */
export interface SessionClient {
  resumeSession(
    signer: Signer,
    store: SessionKeyStore,
    options?: { onEnded?: (reason: SessionEndReason, session: GuardianSession) => void },
  ): Promise<GuardianSession | null>;
  startSession(
    signer: Signer,
    options?: {
      store?: SessionKeyStore;
      confirm?: (grant: SessionGrantFields) => boolean | Promise<boolean>;
      onEnded?: (reason: SessionEndReason, session: GuardianSession) => void;
    },
  ): Promise<GuardianSession>;
}

export function sessionClientFor(guardian: GuardianHttpClient): SessionClient {
  return {
    resumeSession: (signer, store, options) => resumeGuardianSession(guardian, signer, store, options),
    startSession: (signer, options) => startGuardianSession(guardian, signer, options),
  };
}

/** Revokes `session` on Guardian, stops `guardian` using it and forgets its stored key. */
export function closeGuardianSession(guardian: GuardianHttpClient, session: GuardianSession, store: SessionKeyStore): Promise<boolean> {
  return endGuardianSession(guardian, session, store);
}

export interface OpenSessionOptions {
  store: SessionKeyStore;
  /** Shows the grant to the user; required by wallets that sign it as a hash. */
  confirm: (grant: SessionGrantFields) => Promise<boolean>;
  onEnded: (reason: SessionEndReason) => void;
}

/**
 * Resumes the session this wallet stored for this Guardian, or starts one
 * (one wallet approval). Never throws: the result is the state to show.
 */
export async function openGuardianSession(
  client: SessionClient,
  signer: Signer,
  { store, confirm, onEnded }: OpenSessionOptions,
): Promise<{ state: GuardianSessionState; session: GuardianSession | null }> {
  try {
    const resumed = await client.resumeSession(signer, store, { onEnded });
    const session = resumed ?? await client.startSession(signer, {
      store,
      // An EIP-712 wallet (Ledger) shows the grant's fields itself.
      confirm: signer.requestAuthFormat === 'eip712' ? undefined : confirm,
      onEnded,
    });
    return { state: { phase: 'active', expiresAt: session.expiresAt }, session };
  } catch (error) {
    return { state: sessionFailure(error), session: null };
  }
}

function sessionFailure(error: unknown): GuardianSessionState {
  if (error instanceof GuardianSessionsUnsupportedError) return { phase: 'unsupported' };
  // Not a cosigner of any account on this Guardian yet (Guardian answers 403).
  if (error instanceof GuardianHttpError && error.status === 403) return { phase: 'waiting' };
  if (error instanceof SessionGrantDeclinedError) {
    return { phase: 'failed', message: 'Session declined: Guardian requests ask the wallet each time.' };
  }
  return { phase: 'failed', message: formatError(error, 'Could not start a Guardian session') };
}

/** What the confirm dialog shows for a grant. */
export function sessionGrantRows(grant: SessionGrantFields): Array<{ label: string; value: string }> {
  return describeSessionGrant(grant);
}
