import type { MidenClient, Note, NoteId, NoteInclusionProof } from '@miden-sdk/miden-sdk';
import { base64ToBytes, bytesToBase64 } from './base64';

/**
 * Private notes reach their recipient through the note transport, which only
 * accepts a note together with its inclusion proof: proof that the note is
 * committed on-chain (Miden SDK 0.17). So a private send is delivered AFTER
 * the transaction that creates it lands, not before.
 *
 * The note is kept in memory from just before execution until it is delivered,
 * so it can be relayed as soon as the transaction lands. It is dropped when the
 * execution fails, and it does not survive a reload: from then on Guardian is
 * the only source. Guardian keeps every canonical transaction's full summary,
 * and the private-note guard (privateNoteGuard.ts) re-delivers the private
 * notes of the latest one before the account can be used. A stale local copy
 * can therefore never block an account.
 */
export interface PendingDelivery {
  accountId: string;
  proposalId: string;
  recipientId: string;
  /** Serialized notes, base64. */
  notes: string[];
  /** When execution was attempted, ms since the epoch. */
  createdAt: number;
}

const pending = new Map<string, PendingDelivery>();

// Earlier versions kept these records in localStorage, where a transaction that
// never landed left the account blocked until the record expired. Drop them.
try {
  globalThis.localStorage?.removeItem('pendingPrivateDeliveries');
} catch {
  /* storage unavailable */
}

const sameAccount = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export function pendingDeliveries(accountId: string): PendingDelivery[] {
  return [...pending.values()].filter((r) => sameAccount(r.accountId, accountId));
}

export function recordPendingDelivery(record: PendingDelivery): void {
  pending.set(record.proposalId, record);
}

export function removePendingDelivery(proposalId: string): void {
  pending.delete(proposalId);
}

export function encodeNote(note: Note): string {
  return bytesToBase64(note.serialize());
}

export function decodeNote(encoded: string, deserialize: (bytes: Uint8Array) => Note): Note {
  return deserialize(base64ToBytes(encoded));
}

export interface DeliveryOptions {
  /** The note's inclusion proof once it is committed, undefined before. */
  fetchProof: (noteId: NoteId) => Promise<NoteInclusionProof | undefined>;
  timeoutMs?: number;
  pollMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

/**
 * Waits until each note is committed, then relays it with its inclusion proof.
 * Throws if a note is not committed within `timeoutMs` or the transport
 * refuses it; already delivered notes are not re-sent within one call.
 */
export async function deliverCommittedNotes(
  midenClient: Pick<MidenClient, 'notes'>,
  notes: Note[],
  recipientId: string,
  { fetchProof, timeoutMs = 180_000, pollMs = 3_000, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) }: DeliveryOptions,
): Promise<void> {
  for (const note of notes) {
    let inclusionProof: NoteInclusionProof | undefined;
    for (let waited = 0; ; waited += pollMs) {
      inclusionProof = await fetchProof(note.id());
      if (inclusionProof) break;
      if (waited >= timeoutMs) {
        throw new Error('The private note is not on-chain yet, so it cannot be delivered. It will be retried.');
      }
      await sleep(pollMs);
    }
    await midenClient.notes.sendPrivate({ note, to: recipientId, inclusionProof });
  }
}
