import { describe, expect, it, vi } from 'vitest';
import type { MidenClient, Note } from '@miden-sdk/miden-sdk';
import { privateNoteIdsToDeliver, relayProposalNotes } from '../../src/lib/multisigApi';

type RelayArgs = { noteId: string; to: string };

function client(sendPrivateOutput: (args: RelayArgs) => Promise<void>) {
  const calls: string[] = [];
  const midenClient = {
    sync: vi.fn(async () => { calls.push('sync'); }),
    notes: {
      sendPrivateOutput: vi.fn(async (args: RelayArgs) => { calls.push(`relay:${args.noteId}`); return sendPrivateOutput(args); }),
    },
  } as unknown as MidenClient & { notes: { sendPrivateOutput: ReturnType<typeof vi.fn> } };
  return { midenClient, calls };
}
const note = (id: string) => ({ id: () => ({ toString: () => id }) }) as unknown as Note;
const retry = { attempts: 3, delayMs: 0, sleep: async () => {} };

describe('privateNoteIdsToDeliver (checked before execution)', () => {
  it('returns the id of every private note the proposal creates', () => {
    expect(privateNoteIdsToDeliver('summary', () => [note('a'), note('b')])).toEqual(['a', 'b']);
  });

  it('refuses a private send with no private note instead of treating it as deliverable', () => {
    expect(() => privateNoteIdsToDeliver('summary', () => [])).toThrow('cannot be executed safely');
  });
});

describe('relayProposalNotes (run after execution)', () => {
  it('syncs first, then delivers every note by id', async () => {
    const { midenClient, calls } = client(async () => {});
    const count = await relayProposalNotes(midenClient, ['a', 'b'], '0xrecipient', retry);
    expect(count).toBe(2);
    expect(calls).toEqual(['sync', 'relay:a', 'relay:b']);
    expect(midenClient.notes.sendPrivateOutput).toHaveBeenCalledWith({ noteId: 'a', to: '0xrecipient' });
  });

  it('retries only the note whose inclusion proof was not there yet', async () => {
    let bAttempts = 0;
    const { midenClient, calls } = client(async ({ noteId }) => {
      if (noteId === 'b' && ++bAttempts === 1) throw new Error('no inclusion proof yet');
    });
    const count = await relayProposalNotes(midenClient, ['a', 'b'], '0xrecipient', retry);
    expect(count).toBe(2);
    expect(calls).toEqual(['sync', 'relay:a', 'relay:b', 'sync', 'relay:b']);
  });

  it('keeps relaying when a sync fails, since the proof may already be stored', async () => {
    const { midenClient } = client(async () => {});
    (midenClient.sync as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('rpc blip'));
    await expect(relayProposalNotes(midenClient, ['a'], '0xrecipient', retry)).resolves.toBe(1);
  });

  it('fails when a note is still undelivered after the last attempt, and says why', async () => {
    const { midenClient, calls } = client(async ({ noteId }) => {
      if (noteId === 'b') throw new Error('note transport unavailable');
    });
    await expect(relayProposalNotes(midenClient, ['a', 'b'], '0xrecipient', retry)).rejects.toThrow(
      '1 of 2 private note(s) could not be delivered after 3 attempts: note transport unavailable',
    );
    expect(calls.filter((c) => c === 'relay:a')).toHaveLength(1);
    expect(calls.filter((c) => c === 'relay:b')).toHaveLength(3);
  });
});
