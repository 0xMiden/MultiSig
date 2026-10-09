import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Note, NoteId, NoteInclusionProof } from '@miden-sdk/miden-sdk';
import {
  DELIVERY_GIVE_UP_MS,
  deliverCommittedNotes,
  pendingDeliveries,
  recordPendingDelivery,
  removePendingDelivery,
} from '../../src/lib/privateDelivery';

// Miden SDK 0.17: the note transport only accepts a note with its inclusion
// proof, so a private note is delivered after its transaction commits.
const note = (id: string) => ({ id: () => id as unknown as NoteId }) as unknown as Note;
const proof = (id: string) => ({ id }) as unknown as NoteInclusionProof;
const sleep = async () => {};

describe('deliverCommittedNotes', () => {
  it('waits for each note to be committed, then relays it with its inclusion proof', async () => {
    const sendPrivate = vi.fn(async () => {});
    let polls = 0;
    const fetchProof = vi.fn(async (id: NoteId) => (++polls >= 3 ? proof(String(id)) : undefined));
    await deliverCommittedNotes({ notes: { sendPrivate } } as never, [note('a')], '0xrecipient', { fetchProof, sleep });
    expect(polls).toBe(3);
    expect(sendPrivate).toHaveBeenCalledWith({ note: expect.anything(), to: '0xrecipient', inclusionProof: proof('a') });
  });

  it('delivers every note of the send', async () => {
    const sendPrivate = vi.fn(async () => {});
    await deliverCommittedNotes({ notes: { sendPrivate } } as never, [note('a'), note('b')], '0xr', {
      fetchProof: async (id) => proof(String(id)), sleep,
    });
    expect(sendPrivate).toHaveBeenCalledTimes(2);
  });

  it('gives up with a retryable error if the note never commits', async () => {
    const sendPrivate = vi.fn(async () => {});
    await expect(deliverCommittedNotes({ notes: { sendPrivate } } as never, [note('a')], '0xr', {
      fetchProof: async () => undefined, sleep, timeoutMs: 6_000, pollMs: 3_000,
    })).rejects.toThrow(/not on-chain yet.*retried/);
    expect(sendPrivate).not.toHaveBeenCalled();
  });

  it('surfaces a transport refusal so the note stays pending', async () => {
    const down = new Error('transport unavailable');
    await expect(deliverCommittedNotes({ notes: { sendPrivate: async () => { throw down; } } } as never, [note('a')], '0xr', {
      fetchProof: async (id) => proof(String(id)), sleep,
    })).rejects.toBe(down);
  });
});

describe('pending delivery records', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v); },
    });
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  const record = (proposalId: string, accountId = '0xAbC', createdAt = Date.now()) =>
    ({ accountId, proposalId, recipientId: '0xr', notes: ['bm90ZQ=='], createdAt });

  it('keeps a note pending until it is removed after delivery', () => {
    recordPendingDelivery(record('p1'));
    expect(pendingDeliveries('0xabc').map((r) => r.proposalId)).toEqual(['p1']);
    removePendingDelivery('p1');
    expect(pendingDeliveries('0xabc')).toEqual([]);
  });

  it('is scoped to the account and replaces a re-recorded proposal', () => {
    recordPendingDelivery(record('p1'));
    recordPendingDelivery(record('p1'));
    recordPendingDelivery(record('p2', '0xother'));
    expect(pendingDeliveries('0xabc')).toHaveLength(1);
  });

  it('stops retrying a note that never appeared on-chain', () => {
    recordPendingDelivery(record('old', '0xabc', Date.now() - DELIVERY_GIVE_UP_MS - 1));
    expect(pendingDeliveries('0xabc')).toEqual([]);
  });
});
