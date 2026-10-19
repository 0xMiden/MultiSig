import { describe, it, expect, vi } from 'vitest';
import { AccountId, FungibleAsset, Note, NoteAssets, NoteAttachment, NoteType, Word, type NoteArray, type ForeignAccountArray } from '@miden-sdk/miden-sdk';
import {
  buildCustomNoteRequestBuilder,
  createCustomNoteProposalWith,
  draftRecipe,
  type CustomNoteRequestClient,
} from '@/lib/customNote/request';
import { decodeRecipeLabel, noteToHex, type CustomNoteRecipe } from '@/lib/customNote/recipe';

const SENDER = '0x7678d3cca43430813172a4b980bd6a';
const RECIPIENT = '0x6193fede3d413581448dbceed2be2b';
const FAUCET = '0x4cbdcaffe75f0a317482224dae6436';

function note(type: NoteType = NoteType.Public): Note {
  return Note.createP2IDNote(
    AccountId.fromHex(SENDER), AccountId.fromHex(RECIPIENT),
    new NoteAssets([new FungibleAsset(AccountId.fromHex(FAUCET), 50_000n)]), type, new NoteAttachment(),
  );
}

describe('draftRecipe', () => {
  it('carries the note, the sender and the options, with the auth arguments still unpinned', () => {
    const n = note();
    const draft = draftRecipe(n, SENDER, { foreignAccountIds: [FAUCET], description: 'pay the auditor' });
    expect(draft).toEqual({
      recipeVersion: 1, senderAccountId: SENDER, noteHex: noteToHex(n), foreignAccountIds: [FAUCET],
      description: 'pay the auditor', saltHex: '', boundBlockNum: 0,
    });
  });

  // The private-note guard delivers only P2ID notes, whose recipient it can read; a private custom
  // note would be undeliverable and block the account after execution.
  it('refuses a private note', () => {
    expect(() => draftRecipe(note(NoteType.Private), SENDER)).toThrow(/public/i);
  });
});

/** A client whose fee-aware builder records what it is given and what is chained onto it. */
function fakeClient() {
  const calls: { sender?: string; saltHex?: string; boundBlockNum?: number; foreign?: ForeignAccountArray; notes?: NoteArray; synced: number } = { synced: 0 };
  const builder = {
    withForeignAccounts(foreign: ForeignAccountArray) { calls.foreign = foreign; return builder; },
    withOwnOutputNotes(notes: NoteArray) { calls.notes = notes; return builder; },
  };
  const client: CustomNoteRequestClient = {
    sync: async () => { calls.synced += 1; },
    feeAwareTransactionRequestBuilder: async (sender, options) => {
      calls.sender = sender;
      calls.saltHex = options.feeConversionSalt?.toHex();
      calls.boundBlockNum = options.boundBlockNum;
      return builder as never;
    },
  };
  return { client, calls, builder };
}

describe('buildCustomNoteRequestBuilder', () => {
  it('pins the recipe salt and bound block, adds the note as own output and the foreign accounts', async () => {
    const n = note();
    const recipe: CustomNoteRecipe = { ...draftRecipe(n, SENDER, { foreignAccountIds: [FAUCET] }), saltHex: '0x' + '1'.repeat(64), boundBlockNum: 42 };
    const { client, calls, builder } = fakeClient();

    const built = await buildCustomNoteRequestBuilder(client, recipe);

    expect(built.builder).toBe(builder);
    expect(built.recipe).toEqual(recipe);
    expect(calls.synced).toBe(1);
    expect(calls.sender).toBe(SENDER);
    expect(calls.saltHex).toBe(Word.fromHex(recipe.saltHex).toHex());
    expect(calls.boundBlockNum).toBe(42);
    expect(calls.notes?.length()).toBe(1);
    expect(calls.notes?.get(0)?.id().toString()).toBe(n.id().toString());
    expect(calls.foreign?.length()).toBe(1);
  });

  it('draws a fresh salt for a draft, records it, leaves the bound block to the client, adds no foreign accounts', async () => {
    const recipe = draftRecipe(note(), SENDER);
    const { client, calls } = fakeClient();

    const built = await buildCustomNoteRequestBuilder(client, recipe);

    expect(built.recipe.saltHex).toMatch(/^0x[0-9a-f]{64}$/);
    expect(calls.saltHex).toBe(built.recipe.saltHex);
    expect(calls.boundBlockNum).toBeUndefined();
    expect(calls.foreign).toBeUndefined();
    const again = await buildCustomNoteRequestBuilder(client, draftRecipe(note(), SENDER));
    expect(again.recipe.saltHex).not.toBe(built.recipe.saltHex);
  });

  it('still builds when the pre-build sync fails: the build itself reports a real problem', async () => {
    const { client, calls } = fakeClient();
    client.sync = async () => { throw new Error('offline'); };
    await expect(buildCustomNoteRequestBuilder(client, draftRecipe(note(), SENDER))).resolves.toBeTruthy();
    expect(calls.sender).toBe(SENDER);
  });
});

describe('createCustomNoteProposalWith', () => {
  it('submits the request bytes under the recipe label and stores the recipe with the note id', async () => {
    const recipe: CustomNoteRecipe = { ...draftRecipe(note(), SENDER), saltHex: '0x' + '1'.repeat(64), boundBlockNum: 42 };
    const bytes = new Uint8Array([1, 2, 3]);
    const createCustomProposal = vi.fn().mockResolvedValue({ id: 'p1' });
    const stored = new Map<string, string>();
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: { getItem: (k: string) => stored.get(k) ?? null, setItem: (k: string, v: string) => void stored.set(k, v) } } });

    const proposal = await createCustomNoteProposalWith({ createCustomProposal }, { request: { serialize: () => bytes }, recipe }, '0xnote');

    expect(proposal).toEqual({ id: 'p1' });
    const [sent, label, options] = createCustomProposal.mock.calls[0];
    expect(sent).toBe(bytes);
    expect(decodeRecipeLabel(label)).toEqual(recipe);
    expect(options).toEqual({});
    expect(JSON.parse(stored.get('customNoteRecipe:p1')!)).toEqual({ ...recipe, noteIdHex: '0xnote' });
  });
});
