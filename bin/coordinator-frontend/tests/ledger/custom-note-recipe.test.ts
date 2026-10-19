import { describe, it, expect, beforeEach } from 'vitest';
import { AccountId, FungibleAsset, Note, NoteAssets, NoteAttachment, NoteType } from '@miden-sdk/miden-sdk';
import {
  decodeRecipeLabel,
  encodeRecipeLabel,
  loadRecipe,
  resolveCustomNoteId,
  saveRecipe,
  type CustomNoteRecipe,
} from '@/lib/customNote/recipe';

const SENDER = '0x7678d3cca43430813172a4b980bd6a';
const RECIPIENT = '0x6193fede3d413581448dbceed2be2b';
const FAUCET = '0x4cbdcaffe75f0a317482224dae6436';

function publicNote(): Note {
  return Note.createP2IDNote(
    AccountId.fromHex(SENDER), AccountId.fromHex(RECIPIENT),
    new NoteAssets([new FungibleAsset(AccountId.fromHex(FAUCET), 50_000n)]), NoteType.Public, new NoteAttachment(),
  );
}

function recipe(overrides: Partial<CustomNoteRecipe> = {}): CustomNoteRecipe {
  return {
    recipeVersion: 1,
    senderAccountId: SENDER,
    noteHex: Buffer.from(publicNote().serialize()).toString('hex'),
    foreignAccountIds: [],
    saltHex: '0x' + '1'.repeat(64),
    boundBlockNum: 42,
    ...overrides,
  };
}

describe('the recipe label (the OZ custom proposalType) carries the whole recipe to every cosigner', () => {
  it('round-trips a recipe, without the derived noteIdHex', () => {
    const r = recipe({ noteIdHex: '0xderived', description: 'grant BLK_MANAGER', foreignAccountIds: [FAUCET] });
    const label = encodeRecipeLabel(r);
    expect(label.startsWith('note_v1_')).toBe(true);
    expect(decodeRecipeLabel(label)).toEqual({ ...r, noteIdHex: undefined });
    expect(decodeRecipeLabel(label)).not.toHaveProperty('noteIdHex');
  });

  // OZ validates proposalType against ^[a-z0-9_]+$ and stores it lowercased; a label that fails
  // either silently breaks every custom proposal.
  it('is lowercase snake_case and still decodes after lowercasing', () => {
    const r = recipe();
    const label = encodeRecipeLabel(r);
    expect(label).toMatch(/^[a-z0-9_]+$/);
    expect(decodeRecipeLabel(label.toLowerCase())).toEqual(r);
  });

  it('is null for labels of other proposal kinds, truncated payloads and other versions', () => {
    expect(decodeRecipeLabel('p2id')).toBeNull();
    expect(decodeRecipeLabel('usdcx_v1_abc')).toBeNull();
    expect(decodeRecipeLabel(encodeRecipeLabel(recipe()).slice(0, 40))).toBeNull();
    expect(decodeRecipeLabel('note_v2_' + encodeRecipeLabel(recipe()).slice('note_v1_'.length))).toBeNull();
  });

  it('rejects a payload that is not a recipe', () => {
    // A valid base32 JSON object with the wrong shape must not come back as a recipe.
    const forged = encodeRecipeLabel({ ...recipe(), noteHex: 'zz' });
    expect(decodeRecipeLabel(forged)).toBeNull();
  });
});

describe('resolveCustomNoteId', () => {
  it('is the id of the note the recipe carries, and prefers the stored noteIdHex', () => {
    const note = publicNote();
    const r = recipe({ noteHex: Buffer.from(note.serialize()).toString('hex') });
    expect(resolveCustomNoteId(r)).toBe(note.id().toString());
    expect(resolveCustomNoteId({ ...r, noteIdHex: '0xstored' })).toBe('0xstored');
  });
});

describe('the proposer keeps a local copy of the recipe, keyed by proposal id', () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        localStorage: {
          getItem: (k: string) => store.get(k) ?? null,
          setItem: (k: string, v: string) => void store.set(k, v),
        },
      },
    });
  });

  it('round-trips through localStorage and is null when nothing is stored', () => {
    const r = recipe({ noteIdHex: '0xid' });
    saveRecipe('proposal-1', r);
    expect(loadRecipe('proposal-1')).toEqual(r);
    expect(loadRecipe('proposal-2')).toBeNull();
  });
});
