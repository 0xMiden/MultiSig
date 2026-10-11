import { describe, expect, it } from 'vitest';
import {
  AccountId,
  FungibleAsset,
  Note,
  NoteAssets,
  NoteAttachment,
  NoteType,
} from '@miden-sdk/miden-sdk';
import { ensureLatestPrivateNotesDelivered, type GuardNote } from '../../src/lib/privateNoteGuard';
import { p2idRecipient } from '../../src/lib/multisigApi';

const SENDER = '0x7678d3cca43430813172a4b980bd6a';
const RECIPIENT = '0x6193fede3d413581448dbceed2be2b';
const FAUCET = '0x4cbdcaffe75f0a317482224dae6436';

type Fake = GuardNote & { block?: number; consumed?: boolean };

function guard(notes: Fake[], options: { failDeliver?: Set<string>; landsAfterPolls?: number } = {}) {
  const delivered: Array<[string, string]> = [];
  let polls = 0;
  const run = ensureLatestPrivateNotesDelivered<Fake>({
    latestPrivateNotes: async () => notes,
    committedAt: async (note) => {
      polls += 1;
      if (options.landsAfterPolls !== undefined && polls <= options.landsAfterPolls) return undefined;
      return note.block;
    },
    isConsumed: async (note) => Boolean(note.consumed),
    deliver: async (note, to) => {
      if (options.failDeliver?.has(note.id)) throw new Error('transport unavailable');
      delivered.push([note.id, to]);
    },
    waitMs: 9_000,
    pollMs: 3_000,
    sleep: async () => {},
  });
  return { run, delivered };
}

describe('private note guard: the latest transaction', () => {
  it('is clear when the latest transaction has no private notes', async () => {
    const { run, delivered } = guard([]);
    await expect(run).resolves.toEqual({ delivered: 0, consumed: 0 });
    expect(delivered).toEqual([]);
  });

  it('re-delivers every unconsumed note of the latest delta, and skips consumed ones', async () => {
    const { run, delivered } = guard([
      { id: 'note-a', recipientId: RECIPIENT, block: 10 },
      { id: 'note-b', recipientId: RECIPIENT, block: 10, consumed: true },
      { id: 'note-c', recipientId: SENDER, block: 10 },
    ]);
    await expect(run).resolves.toEqual({ delivered: 2, consumed: 1 });
    expect(delivered).toEqual([['note-a', RECIPIENT], ['note-c', SENDER]]);
  });

  it('blocks when an unconsumed note cannot be delivered', async () => {
    const { run } = guard(
      [{ id: '0xda80a9f5832559613a79a6339b6ad23b5c5b34a2e45c1e6a7df389e048fc18fd', recipientId: RECIPIENT, block: 10 }],
      { failDeliver: new Set(['0xda80a9f5832559613a79a6339b6ad23b5c5b34a2e45c1e6a7df389e048fc18fd']) },
    );
    await expect(run).rejects.toThrow(/0xda80a9…18fd could not be delivered to 0x6193fe…be2b: transport unavailable/);
  });

  it('does not block on a consumed note even when delivery would fail', async () => {
    const { run } = guard([{ id: 'n', recipientId: RECIPIENT, block: 10, consumed: true }], { failDeliver: new Set(['n']) });
    await expect(run).resolves.toEqual({ delivered: 0, consumed: 1 });
  });

  it('waits for a note to land, then delivers it', async () => {
    const { run, delivered } = guard([{ id: 'n', recipientId: RECIPIENT, block: 12 }], { landsAfterPolls: 2 });
    await expect(run).resolves.toEqual({ delivered: 1, consumed: 0 });
    expect(delivered).toEqual([['n', RECIPIENT]]);
  });

  it('blocks when a note never shows up on-chain within the wait', async () => {
    const { run } = guard([{ id: 'n', recipientId: RECIPIENT }]);
    await expect(run).rejects.toThrow(/not on-chain yet/);
  });

  it('blocks on an unconsumed note whose recipient is unknown (not P2ID)', async () => {
    const { run } = guard([{ id: 'n', recipientId: undefined, block: 10 }]);
    await expect(run).rejects.toThrow(/no known recipient/);
  });
});

describe('p2idRecipient', () => {
  const assets = () => new NoteAssets([new FungibleAsset(AccountId.fromHex(FAUCET), 50_000n)]);

  it('reads the target account of a P2ID note back from the note itself', () => {
    const note = Note.createP2IDNote(
      AccountId.fromHex(SENDER), AccountId.fromHex(RECIPIENT), assets(), NoteType.Private, new NoteAttachment(),
    );
    expect(p2idRecipient(note)).toBe(RECIPIENT);
  });

  it('is undefined for any other note script', () => {
    const note = Note.createP2IDENote(
      AccountId.fromHex(SENDER), AccountId.fromHex(RECIPIENT), assets(), 100, null, NoteType.Private, new NoteAttachment(),
    );
    expect(p2idRecipient(note)).toBeUndefined();
  });
});
