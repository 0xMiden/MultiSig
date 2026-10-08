import type { MidenClient, Note, NoteId, NoteInclusionProof } from '@miden-sdk/miden-sdk';

/**
 * Private notes reach their recipient through the note transport, which only
 * accepts a note together with its inclusion proof: proof that the note is
 * committed on-chain (Miden SDK 0.17). So a private send is delivered AFTER
 * the transaction that creates it lands, not before.
 *
 * To make sure a committed note is never left undelivered (its funds would be
 * unusable for the recipient), the note is recorded locally before execution
 * and removed only once delivered. A pending record is retried on the next
 * attempt (after a reload, on sync, or by the user).
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

const STORAGE_KEY = 'pendingPrivateDeliveries';
/** A note that never appears on-chain within this window was not committed; stop retrying it. */
export const DELIVERY_GIVE_UP_MS = 24 * 60 * 60 * 1000;

function readAll(): PendingDelivery[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(records: PendingDelivery[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    /* storage unavailable: delivery still runs now, it just can't be resumed later */
  }
}

const sameAccount = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export function pendingDeliveries(accountId: string, now = Date.now()): PendingDelivery[] {
  return readAll().filter((r) => sameAccount(r.accountId, accountId) && now - r.createdAt < DELIVERY_GIVE_UP_MS);
}

export function recordPendingDelivery(record: PendingDelivery): void {
  writeAll([...readAll().filter((r) => r.proposalId !== record.proposalId), record]);
}

export function removePendingDelivery(proposalId: string): void {
  writeAll(readAll().filter((r) => r.proposalId !== proposalId));
}

export function encodeNote(note: Note): string {
  let binary = '';
  for (const byte of note.serialize()) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function decodeNote(encoded: string, deserialize: (bytes: Uint8Array) => Note): Note {
  return deserialize(Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0)));
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
