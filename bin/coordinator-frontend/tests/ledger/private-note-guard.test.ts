import { describe, expect, it } from 'vitest';
import {
  AccountId,
  FungibleAsset,
  Note,
  NoteAssets,
  NoteAttachment,
  NoteType,
} from '@miden-sdk/miden-sdk';
import {
  BLOCKED_UNDELIVERED,
  BLOCKED_UNVERIFIED,
  ensureLatestPrivateNotesDelivered,
  isPrivateNoteBlockedMessage,
  PrivateNoteBlockedError,
  UndeliveredPrivateNoteError,
  type GuardNote,
} from '../../src/lib/privateNoteGuard';
import { latestCanonicalPrivateNotes, p2idRecipient } from '../../src/lib/multisigApi';

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

describe('what blocks the account (review of 0xMiden/MultiSig#33)', () => {
  it('a note that cannot be delivered is "undelivered"; a check that cannot run is not', async () => {
    const undelivered = guard([{ id: 'n', recipientId: RECIPIENT, block: 10 }], { failDeliver: new Set(['n']) }).run;
    await expect(undelivered).rejects.toBeInstanceOf(UndeliveredPrivateNoteError);
    const unreachable = ensureLatestPrivateNotesDelivered<Fake>({
      latestPrivateNotes: async () => { throw new Error('GUARDIAN HTTP error 503'); },
      committedAt: async () => 1, isConsumed: async () => false, deliver: async () => {},
    });
    await expect(unreachable).rejects.toThrow('503');
    await expect(unreachable).rejects.not.toBeInstanceOf(UndeliveredPrivateNoteError);
  });

  it('refusals carry their own message, recognisable once the account is clear again', () => {
    const blocked = new PrivateNoteBlockedError('Private note 0xda80…18fd could not be delivered', true);
    const paused = new PrivateNoteBlockedError('GUARDIAN HTTP error 503', false);
    expect(blocked.message).toBe(`${BLOCKED_UNDELIVERED} Private note 0xda80…18fd could not be delivered`);
    expect(paused.message).toBe(`${BLOCKED_UNVERIFIED} GUARDIAN HTTP error 503`);
    expect(isPrivateNoteBlockedMessage(blocked.message)).toBe(true);
    expect(isPrivateNoteBlockedMessage(paused.message)).toBe(true);
    expect(isPrivateNoteBlockedMessage('Wallet is not connected')).toBe(false);
  });
});

describe('latestCanonicalPrivateNotes', () => {
  const entry = (outputNotes: Array<{ noteType: 'public' | 'private' }>, decodeWarnings: unknown[] = []) =>
    ({ nonce: 7, status: 'canonical', timestamp: '', inputNotes: [], outputNotes, decodeWarnings });
  const multisig = (entries: unknown[]) =>
    ({ accountId: SENDER, deltaHistory: async () => ({ entries }) }) as never;
  const guardianWith = (deltaPayload: unknown) => {
    const calls: number[] = [];
    return { calls, guardian: { getDelta: async (_a: string, nonce: number) => { calls.push(nonce); return { deltaPayload } as never; } } };
  };
  const privateNote = () => Note.createP2IDNote(
    AccountId.fromHex(SENDER), AccountId.fromHex(RECIPIENT),
    new NoteAssets([new FungibleAsset(AccountId.fromHex(FAUCET), 50_000n)]), NoteType.Private, new NoteAttachment(),
  );

  it('has nothing to check for an account without history', async () => {
    const { guardian, calls } = guardianWith({});
    await expect(latestCanonicalPrivateNotes(multisig([]), guardian)).resolves.toEqual([]);
    expect(calls).toEqual([]);
  });

  it('skips the second (signed) request when Guardian lists no private note', async () => {
    const { guardian, calls } = guardianWith({});
    await expect(latestCanonicalPrivateNotes(multisig([entry([{ noteType: 'public' }])]), guardian)).resolves.toEqual([]);
    expect(calls).toEqual([]);
  });

  it('reads the notes when Guardian lists a private note or could not decode one', async () => {
    const { guardian, calls } = guardianWith({ txSummary: { data: 'c3VtbWFyeQ==' } });
    const notes = await latestCanonicalPrivateNotes(multisig([entry([{ noteType: 'private' }])]), guardian, () => [privateNote()]);
    expect(calls).toEqual([7]);
    expect(notes.map((n) => n.recipientId)).toEqual([RECIPIENT]);
    await latestCanonicalPrivateNotes(multisig([entry([], [{ section: 'output_notes', reason: 'drift' }])]), guardian, () => []);
    expect(calls).toEqual([7, 7]);
  });

  it('never reports clear on fewer notes than Guardian lists, or without a summary', async () => {
    const listed = multisig([entry([{ noteType: 'private' }, { noteType: 'private' }])]);
    const { guardian } = guardianWith({ txSummary: { data: 'c3VtbWFyeQ==' } });
    await expect(latestCanonicalPrivateNotes(listed, guardian, () => [privateNote()])).rejects.toThrow(/lists 2 private note\(s\).*only 1 could be read/);
    const { guardian: noSummary } = guardianWith({});
    await expect(latestCanonicalPrivateNotes(listed, noSummary)).rejects.toThrow(/no transaction summary/);
  });
});
