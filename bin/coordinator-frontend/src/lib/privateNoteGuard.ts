import { UserFacingError } from './errors';

/**
 * Private notes must reach their recipient: a private note nobody delivered is
 * money the recipient can never see or spend. The note transport only takes a
 * note with its inclusion proof, so delivery happens after the transaction
 * lands, and can fail after the funds have already moved.
 *
 * So no operation is allowed on an account while a private note from its
 * latest transaction is neither delivered nor consumed. Checking only the
 * latest canonical delta is enough: every earlier one had to pass this check
 * before the account could move on. Guardian keeps every canonical delta with
 * its full transaction summary, private notes included, so any signer on any
 * device can rebuild those notes and deliver them; delivery is idempotent.
 */

export interface GuardNote {
  id: string;
  /** Recipient account ID (P2ID target), or undefined when the note is not a P2ID note. */
  recipientId: string | undefined;
}

export interface GuardDeps<N extends GuardNote> {
  /** Private notes of the account's latest canonical transaction; empty when it has none. */
  latestPrivateNotes: () => Promise<N[]>;
  /** The block the note was committed in, or undefined while it is not on-chain yet. */
  committedAt: (note: N) => Promise<number | undefined>;
  /** True once the recipient has consumed the note. */
  isConsumed: (note: N, committedAt: number) => Promise<boolean>;
  /** Relays the note, with its inclusion proof, to its recipient through the note transport. */
  deliver: (note: N, recipientId: string) => Promise<void>;
  /** How long to wait for a note to appear on-chain, and how often to look. */
  waitMs?: number;
  pollMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

export interface GuardResult {
  /** Notes delivered (or delivered again) by this check. */
  delivered: number;
  /** Notes the recipient has already consumed. */
  consumed: number;
}

/**
 * A private note that exists and still needs delivering could not be
 * delivered. Any other error from the check means it could not be run at all
 * (Guardian or node unreachable); both keep the account blocked.
 */
export class UndeliveredPrivateNoteError extends Error {
  override name = 'UndeliveredPrivateNoteError';
}

/**
 * Delivers every unconsumed private note of the latest transaction. Throws
 * UndeliveredPrivateNoteError, with the reason, when one cannot be delivered,
 * and the underlying error when the check itself fails: the caller blocks the
 * account until a later check succeeds.
 */
export async function ensureLatestPrivateNotesDelivered<N extends GuardNote>({
  latestPrivateNotes,
  committedAt,
  isConsumed,
  deliver,
  waitMs = 60_000,
  pollMs = 3_000,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}: GuardDeps<N>): Promise<GuardResult> {
  const result: GuardResult = { delivered: 0, consumed: 0 };
  for (const note of await latestPrivateNotes()) {
    let block: number | undefined;
    for (let waited = 0; ; waited += pollMs) {
      block = await committedAt(note);
      if (block !== undefined) break;
      if (waited >= waitMs) {
        throw new UndeliveredPrivateNoteError(`Private note ${shortId(note.id)} is not on-chain yet, so it cannot be delivered.`);
      }
      await sleep(pollMs);
    }
    if (await isConsumed(note, block)) {
      result.consumed += 1;
      continue;
    }
    if (!note.recipientId) {
      throw new UndeliveredPrivateNoteError(`Private note ${shortId(note.id)} has no known recipient (not a P2ID note), so it cannot be delivered.`);
    }
    try {
      await deliver(note, note.recipientId);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new UndeliveredPrivateNoteError(`Private note ${shortId(note.id)} could not be delivered to ${shortId(note.recipientId)}: ${reason}`);
    }
    result.delivered += 1;
  }
  return result;
}

function shortId(id: string): string {
  return id.length > 14 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;
}

/**
 * Thrown by an operation the guard refused. Its message is shown as it is:
 * it must never be reworded into a wallet or network error.
 */
export class PrivateNoteBlockedError extends UserFacingError {
  override name = 'PrivateNoteBlockedError';
  constructor(readonly reason: string, readonly undelivered: boolean) {
    super(`${undelivered ? BLOCKED_UNDELIVERED : BLOCKED_UNVERIFIED} ${reason}`);
  }
}

export const BLOCKED_UNDELIVERED = 'Blocked until an earlier private note reaches its recipient.';
export const BLOCKED_UNVERIFIED = 'Paused until earlier private notes can be checked.';

/** True for the message of a PrivateNoteBlockedError (cleared once the account is clear again). */
export function isPrivateNoteBlockedMessage(message: string | null | undefined): boolean {
  return Boolean(message && (message.startsWith(BLOCKED_UNDELIVERED) || message.startsWith(BLOCKED_UNVERIFIED)));
}
