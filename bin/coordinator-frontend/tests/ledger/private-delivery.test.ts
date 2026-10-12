import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Note, NoteId, NoteInclusionProof } from '@miden-sdk/miden-sdk';
import {
  deliverCommittedNotes,
  NoteNotOnChainError,
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
    await expect(deliverCommittedNotes({ notes: { sendPrivate } } as never, [note('a')], '0xrecipient', { fetchProof, sleep }))
      .resolves.toBe('delivered');
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
    })).rejects.toBeInstanceOf(NoteNotOnChainError);
    expect(sendPrivate).not.toHaveBeenCalled();
  });

  it('stops waiting, without sending, once the note is dropped (its execution failed)', async () => {
    const sendPrivate = vi.fn(async () => {});
    let polls = 0;
    const result = deliverCommittedNotes({ notes: { sendPrivate } } as never, [note('a')], '0xr', {
      fetchProof: async () => { polls++; return undefined; }, stillPending: () => polls < 2, sleep,
    });
    await expect(result).resolves.toBe('dropped');
    expect(polls).toBe(2);
    expect(sendPrivate).not.toHaveBeenCalled();
  });

  it('surfaces a transport refusal so the note stays pending', async () => {
    const down = new Error('transport unavailable');
    await expect(deliverCommittedNotes({ notes: { sendPrivate: async () => { throw down; } } } as never, [note('a')], '0xr', {
      fetchProof: async (id) => proof(String(id)), sleep,
    })).rejects.toBe(down);
  });
});

describe('pending delivery records (in memory only)', () => {
  afterEach(() => {
    for (const id of ['p1', 'p2']) removePendingDelivery(id);
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  const record = (proposalId: string, accountId = '0xAbC') =>
    ({ accountId, proposalId, recipientId: '0xr', notes: ['bm90ZQ=='], createdAt: Date.now() });

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

  it('does not survive a reload, and drops records older versions left in localStorage', async () => {
    const store = new Map([['pendingPrivateDeliveries', JSON.stringify([record('stale')])]]);
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v); },
      removeItem: (k: string) => { store.delete(k); },
    });
    vi.resetModules();
    const fresh = await import('../../src/lib/privateDelivery');
    expect(fresh.pendingDeliveries('0xabc')).toEqual([]);
    expect(store.has('pendingPrivateDeliveries')).toBe(false);
  });
});
