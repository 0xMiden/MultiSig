import { describe, expect, it, vi } from 'vitest';
import type { MidenClient, Note } from '@miden-sdk/miden-sdk';
import { relayProposalNotes } from '../../src/lib/multisigApi';

function client(sendPrivate: (args: unknown) => Promise<void>) {
  const calls: string[] = [];
  const midenClient = {
    getSyncHeight: vi.fn(async () => { calls.push('height'); return 4242; }),
    notes: { sendPrivate: vi.fn(async (args: unknown) => { calls.push('relay'); return sendPrivate(args); }) },
  } as unknown as MidenClient & { notes: { sendPrivate: ReturnType<typeof vi.fn> } };
  return { midenClient, calls };
}
const note = (id: string) => ({ id }) as unknown as Note;

describe('relayProposalNotes (review finding 5)', () => {
  it('delivers every private note with a block hint taken before execution', async () => {
    const { midenClient, calls } = client(async () => {});
    const count = await relayProposalNotes(midenClient, 'summary', '0xrecipient', () => [note('a'), note('b')]);
    expect(count).toBe(2);
    expect(calls).toEqual(['height', 'relay', 'relay']);
    expect(midenClient.notes.sendPrivate).toHaveBeenCalledWith({ note: note('a'), to: '0xrecipient', scanAfterBlockNum: 4242 });
  });

  it('refuses a private send with no private note instead of treating it as delivered', async () => {
    const { midenClient } = client(async () => {});
    await expect(relayProposalNotes(midenClient, 'summary', '0xrecipient', () => [])).rejects.toThrow('cannot be executed safely');
    expect(midenClient.notes.sendPrivate).not.toHaveBeenCalled();
  });

  it('propagates a failed relay so execution never starts', async () => {
    const down = new Error('note transport unavailable');
    const { midenClient } = client(async () => { throw down; });
    await expect(relayProposalNotes(midenClient, 'summary', '0xrecipient', () => [note('a')])).rejects.toBe(down);
  });
});
