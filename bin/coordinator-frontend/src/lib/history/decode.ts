/**
 * Pure decoders for the node's `SyncTransactions` wire records (see `./nodeRpc.ts` for the
 * transport and `./proto/miden_node.json` for the schema). Everything here is free of WASM and
 * network so it can be unit-tested against a captured response (`tests/fixtures`).
 *
 * The one piece of cryptography -- a note's id from its header fields -- is injected as
 * {@link NoteIdFromHeader} (the vendored admin wasm's `note_id_from_header`), because the node
 * sends output notes as headers only. Committed notes also come with an inclusion proof naming
 * their id; a note created and consumed within one batch ("erased") has no proof and would
 * otherwise be unidentifiable, which is exactly the fate of an admin note the faucet consumed
 * promptly.
 */

/** A `primitives.Word` on the wire: 32 bytes, four little-endian field elements. */
export interface WireWord {
  encoded: Uint8Array | number[];
}

/** An `account.AccountId` on the wire (v1): two u64s, as `Long`s, numbers or decimal strings. */
export interface WireAccountId {
  v1?: { prefix?: { value?: unknown }; suffix?: { value?: unknown } } | null;
}

export interface WireNoteHeader {
  metadata?: {
    sender?: WireAccountId | null;
    noteType?: number;
    tag?: number;
    attachmentSchemes?: number[];
    attachmentsCommitment?: WireWord | null;
  } | null;
  detailsCommitment?: WireWord | null;
}

export interface WireTransactionRecord {
  blockNum?: number;
  header?: {
    transactionId?: { id?: WireWord | null } | null;
    accountId?: WireAccountId | null;
    initialStateCommitment?: WireWord | null;
    finalStateCommitment?: WireWord | null;
    inputNotes?: { nullifier?: WireWord | null; header?: WireNoteHeader | null }[];
    outputNotes?: WireNoteHeader[];
  } | null;
  outputNoteProofs?: { noteId?: { id?: WireWord | null } | null; blockNum?: { blockNum?: number } | null }[];
  consumedNoteRefs?: { nullifier?: WireWord | null; noteId?: { id?: WireWord | null } | null }[];
}

/** `note.NoteType` wire values. */
export const NOTE_TYPE_PUBLIC = 2;

export type NoteIdFromHeader = (
  detailsCommitment: Uint8Array,
  senderHex: string,
  isPublic: boolean,
  tag: number,
  attachmentSchemes: Uint32Array,
  attachmentsCommitment: Uint8Array,
) => string;

export interface OnChainNote {
  noteIdHex: string;
  tag: number;
  isPublic: boolean;
  senderHex: string;
  attachmentSchemes: number[];
  /**
   * `true` when the node holds an inclusion proof for the note (it was committed to a block);
   * `false` when it was erased, i.e. created and consumed within the same batch.
   */
  committed: boolean;
}

export interface OnChainInputNote {
  nullifierHex: string;
  /** Known for public notes the node could resolve; private notes carry only a nullifier. */
  noteIdHex?: string;
}

export interface OnChainTx {
  blockNum: number;
  txIdHex: string;
  accountIdHex: string;
  initialStateHex: string;
  finalStateHex: string;
  inputNotes: OnChainInputNote[];
  outputNotes: OnChainNote[];
}

export function bytesToHex(bytes: Uint8Array | number[]): string {
  let out = '0x';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

export function wordHex(word: WireWord | null | undefined): string {
  return word?.encoded ? bytesToHex(word.encoded) : '';
}

function toBytes(bytes: Uint8Array | number[]): Uint8Array {
  return bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes);
}

/** A u64 wire value (`Long`, number, bigint or decimal string) as a bigint. */
function u64(value: unknown): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return BigInt(value);
  if (typeof value === 'string') return BigInt(value);
  if (value && typeof value === 'object' && 'toString' in value) {
    // protobufjs `Long`: `toString()` is the unsigned decimal when `unsigned` is set, which the
    // fixed64/uint64 fields here are. Guard against a signed rendering of a high value anyway.
    const s = String(value);
    const n = BigInt(s);
    return n < 0n ? n + (1n << 64n) : n;
  }
  throw new Error(`not a u64 wire value: ${String(value)}`);
}

/**
 * The 15-byte hex account id from its wire `prefix`/`suffix` u64s. The prefix is the first 8 bytes
 * big-endian; the suffix is the remaining 7 bytes followed by one zero byte, big-endian.
 */
export function accountIdHexFromParts(prefix: unknown, suffix: unknown): string {
  const p = u64(prefix).toString(16).padStart(16, '0');
  const s = u64(suffix).toString(16).padStart(16, '0');
  return `0x${p}${s.slice(0, 14)}`;
}

/** The inverse of {@link accountIdHexFromParts}, as decimal strings for the request encoder. */
export function accountIdPartsFromHex(hex: string): { prefix: string; suffix: string } {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (!/^[0-9a-fA-F]{30}$/.test(clean)) throw new Error(`not a 15-byte account id: ${hex}`);
  return {
    prefix: BigInt(`0x${clean.slice(0, 16)}`).toString(),
    suffix: BigInt(`0x${clean.slice(16, 30)}00`).toString(),
  };
}

export function accountIdHex(id: WireAccountId | null | undefined): string {
  const v1 = id?.v1;
  if (!v1?.prefix || !v1.suffix) return '';
  return accountIdHexFromParts(v1.prefix.value, v1.suffix.value);
}

/** Decodes one output note header, deriving its id via `noteId`. */
export function decodeOutputNote(
  header: WireNoteHeader,
  committedIds: ReadonlySet<string>,
  noteId: NoteIdFromHeader,
): OnChainNote {
  const m = header.metadata ?? {};
  const senderHex = accountIdHex(m.sender);
  const isPublic = m.noteType === NOTE_TYPE_PUBLIC;
  const tag = (m.tag ?? 0) >>> 0;
  const attachmentSchemes = (m.attachmentSchemes ?? []).map((s) => s >>> 0);
  const noteIdHex = noteId(
    toBytes(header.detailsCommitment?.encoded ?? []),
    senderHex,
    isPublic,
    tag,
    Uint32Array.from(attachmentSchemes),
    toBytes(m.attachmentsCommitment?.encoded ?? []),
  );
  return { noteIdHex, tag, isPublic, senderHex, attachmentSchemes, committed: committedIds.has(noteIdHex) };
}

/** Decodes a wire `TransactionRecord` into an {@link OnChainTx}. */
export function decodeTransactionRecord(rec: WireTransactionRecord, noteId: NoteIdFromHeader): OnChainTx {
  const h = rec.header ?? {};
  const committedIds = new Set((rec.outputNoteProofs ?? []).map((p) => wordHex(p.noteId?.id)));
  const consumed = new Map(
    (rec.consumedNoteRefs ?? []).map((c) => [wordHex(c.nullifier), wordHex(c.noteId?.id)] as const),
  );
  return {
    blockNum: rec.blockNum ?? 0,
    txIdHex: wordHex(h.transactionId?.id),
    accountIdHex: accountIdHex(h.accountId),
    initialStateHex: wordHex(h.initialStateCommitment),
    finalStateHex: wordHex(h.finalStateCommitment),
    inputNotes: (h.inputNotes ?? []).map((n) => {
      const nullifierHex = wordHex(n.nullifier);
      const noteIdHex = consumed.get(nullifierHex);
      return noteIdHex ? { nullifierHex, noteIdHex } : { nullifierHex };
    }),
    outputNotes: (h.outputNotes ?? []).map((n) => decodeOutputNote(n, committedIds, noteId)),
  };
}
