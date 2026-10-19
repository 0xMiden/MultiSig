import { Note } from '@miden-sdk/miden-sdk';

/**
 * Everything needed to rebuild, byte for byte, the transaction request of a custom-note
 * proposal: a multisig transaction whose own output note is one the caller built (any script,
 * inputs, assets or attachment the SDK can serialize). Guardian's custom-proposal protocol
 * signs a summary of that request and hands back execution advice for a request that
 * reproduces it, so every cosigner, not only the proposer, must be able to rebuild it; the
 * recipe travels to them inside the proposal's label (see `encodeRecipeLabel`) and the
 * proposer also keeps a local copy (`saveRecipe`).
 *
 * `saltHex` and `boundBlockNum` pin the multisig auth arguments the summary binds. They are
 * empty / 0 on a draft and filled in by the first build. `noteIdHex` is derived from `noteHex`
 * and is not part of the label.
 */
export interface CustomNoteRecipe {
  recipeVersion: 1;
  /** The multisig account that proposes, signs and sends the note. */
  senderAccountId: string;
  /** The serialized `Note` (`Note.serialize()`), hex without `0x`. */
  noteHex: string;
  /**
   * Public accounts the transaction reads through foreign-procedure invocation, such as a
   * faucet that estimates its own note fee. The web client does not load them on demand.
   */
  foreignAccountIds: string[];
  /** A short, free-form, human-readable purpose for the proposal list. */
  description?: string;
  saltHex: string;
  boundBlockNum: number;
  noteIdHex?: string;
}

const LABEL_PREFIX = 'note_v1_';

/** The note bytes a recipe carries. Throws on a recipe whose hex is not a serialized note. */
export function recipeNoteBytes(recipe: Pick<CustomNoteRecipe, 'noteHex'>): Uint8Array {
  if (!/^(?:[0-9a-f]{2})+$/i.test(recipe.noteHex)) throw new Error('The recipe does not carry a serialized note');
  return new Uint8Array(recipe.noteHex.match(/../g)!.map((pair) => parseInt(pair, 16)));
}

export function noteToHex(note: Note): string {
  return Array.from(note.serialize(), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * The id of the note a recipe's proposal creates: the stored `noteIdHex` when the proposer
 * derived it already, otherwise read off the note the recipe carries. Never taken from a
 * transaction summary's output-note array, where the fee note sits at no fixed index.
 */
export function resolveCustomNoteId(recipe: Pick<CustomNoteRecipe, 'noteHex' | 'noteIdHex'>): string {
  if (recipe.noteIdHex) return recipe.noteIdHex;
  return Note.deserialize(recipeNoteBytes(recipe)).id().toString();
}

// The label is the OpenZeppelin custom proposal's `proposalType`: validated against
// ^[a-z0-9_]+$ and lowercased before it is stored as `rawProposalType`. So the prefix uses
// `_` and the payload is RFC 4648 base32 over [a-z2-7], which survives both.
const BASE32_ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567';

function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = ((value << 8) | byte) >>> 0;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(input: string): Uint8Array {
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of input) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) throw new Error('Invalid base32 character');
    value = ((value << 5) | idx) >>> 0;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

/** The label of a custom-note proposal: `note_v1_` + base32 of the recipe's JSON, minus `noteIdHex`. */
export function encodeRecipeLabel(recipe: CustomNoteRecipe): string {
  // JSON leaves an undefined property out.
  return LABEL_PREFIX + base32Encode(new TextEncoder().encode(JSON.stringify({ ...recipe, noteIdHex: undefined })));
}

/**
 * The recipe a label made by `encodeRecipeLabel` carries, or null for any other label (another
 * proposal kind, another version, a truncated or forged payload). The label comes from Guardian,
 * so its content is checked field by field before it is trusted.
 */
export function decodeRecipeLabel(label: string): CustomNoteRecipe | null {
  if (!label.startsWith(LABEL_PREFIX)) return null;
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(base32Decode(label.slice(LABEL_PREFIX.length))));
    return isRecipe(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isRecipe(value: unknown): value is CustomNoteRecipe {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Record<string, unknown>;
  return (
    r.recipeVersion === 1 &&
    typeof r.senderAccountId === 'string' &&
    typeof r.noteHex === 'string' &&
    /^(?:[0-9a-f]{2})+$/i.test(r.noteHex) &&
    Array.isArray(r.foreignAccountIds) &&
    r.foreignAccountIds.every((id) => typeof id === 'string') &&
    (r.description === undefined || typeof r.description === 'string') &&
    typeof r.saltHex === 'string' &&
    typeof r.boundBlockNum === 'number'
  );
}

function storageKey(proposalId: string): string {
  return `customNoteRecipe:${proposalId}`;
}

/** The proposer's own copy, so it executes without decoding the label. Never throws. */
export function saveRecipe(proposalId: string, recipe: CustomNoteRecipe): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(proposalId), JSON.stringify(recipe));
  } catch {
    // Private mode, quota: the label still carries the recipe.
  }
}

export function loadRecipe(proposalId: string): CustomNoteRecipe | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKey(proposalId));
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return isRecipe(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
