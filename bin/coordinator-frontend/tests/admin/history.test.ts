import { readFileSync } from 'node:fs';
import { describe, it, expect, beforeAll } from 'vitest';
import { initSync, note_id_from_header, account_target_tag } from '@/lib/usdcxAdminWasm/usdcx_admin_notes';
import { __setInitializedForTests } from '@/lib/admin/noteBuilders';
import {
  accountIdHexFromParts,
  accountIdPartsFromHex,
  decodeTransactionRecord,
  type WireTransactionRecord,
} from '@/lib/history/decode';
import {
  classifyNote,
  matchProposals,
  pendingProposalsExecutedOnChain,
  sortNewestFirst,
  type KnownProposal,
} from '@/lib/history/annotate';
import { codec, parseGrpcWebFrames } from '@/lib/history/nodeRpc';
import { miden } from '@/lib/history/proto/miden_node';

// A real `SyncTransactions` response for the testnet admin multisig, captured with the node's
// own encoding (protobufjs `toObject` with longs as strings), so the decoder is exercised on
// genuine wire data, including inclusion proofs for committed notes and an erased note per tx.
const MULTISIG = '0x93a6e276fa374b417db5b93f716e0d';
const FAUCET = '0x4cbdcaffe75f0a317482224dae6436';
const fixture = JSON.parse(readFileSync(new URL('../fixtures/syncTransactions.testnet.json', import.meta.url), 'utf8'));

let records: WireTransactionRecord[];

beforeAll(() => {
  initSync({
    module: readFileSync(new URL('../../src/lib/usdcxAdminWasm/usdcx_admin_notes_bg.wasm', import.meta.url)),
  });
  __setInitializedForTests();
  // Round-trip through the real encoder so the test sees exactly what the browser decodes.
  const Res = miden.node.v1.SyncTransactionsResponse;
  const decoded = codec.decodeSyncTransactionsResponse(Res.encode(Res.fromObject(fixture)).finish());
  records = decoded.transactions as WireTransactionRecord[];
});

describe('account id <-> wire parts', () => {
  it('round-trips the multisig id through prefix/suffix', () => {
    const parts = accountIdPartsFromHex(MULTISIG);
    expect(parts).toEqual({ prefix: '10639440170341321537', suffix: '9058349907662736640' });
    expect(accountIdHexFromParts(parts.prefix, parts.suffix)).toBe(MULTISIG);
  });

  it('rejects a malformed id', () => {
    expect(() => accountIdPartsFromHex('0x1234')).toThrow();
  });
});

describe('decodeTransactionRecord on real testnet data', () => {
  it('decodes every record with the multisig as the account and a 32-byte tx id', () => {
    expect(records.length).toBe(10);
    for (const r of records) {
      const tx = decodeTransactionRecord(r, note_id_from_header);
      expect(tx.accountIdHex).toBe(MULTISIG);
      expect(tx.txIdHex).toMatch(/^0x[0-9a-f]{64}$/);
      expect(tx.blockNum).toBeGreaterThan(0);
    }
  });

  it('derives output note ids that match the node inclusion proofs, and flags the erased one', () => {
    const last = decodeTransactionRecord(records[records.length - 1], note_id_from_header);
    expect(last.blockNum).toBe(51088);
    const committed = last.outputNotes.filter((n) => n.committed).map((n) => n.noteIdHex);
    expect(committed.sort()).toEqual(
      ['0x2e98ec6cd6a1618520197cdebd953cfada10189eea5b908034963124f9de03b3', '0x91e09102d8666e07efc461b652b4b23ec4f0b49951ff9948c0273ee6bbd25c3a'].sort(),
    );
    const erased = last.outputNotes.filter((n) => !n.committed);
    expect(erased).toHaveLength(1);
    expect(erased[0].noteIdHex).toBe('0x35c2db77f9ea8f816704aa938e8f0c4c1f46df523765858334bdf84574461a56');
  });

  it('resolves consumed public input notes to their ids', () => {
    const first = decodeTransactionRecord(records[0], note_id_from_header);
    expect(first.inputNotes).toHaveLength(1);
    expect(first.inputNotes[0].noteIdHex).toMatch(/^0x[0-9a-f]{64}$/);
    expect(first.inputNotes[0].nullifierHex).toMatch(/^0x[0-9a-f]{64}$/);
  });
});

describe('classifyNote', () => {
  it('tells the admin note from its fee sponsorship by the faucet tag and attachments', () => {
    const tags = { faucetTag: account_target_tag(FAUCET), feeFaucetTag: null };
    const last = decodeTransactionRecord(records[records.length - 1], note_id_from_header);
    const roles = last.outputNotes.map((n) => classifyNote(n, tags)).sort();
    expect(roles).toEqual(['admin', 'fee_sponsorship', 'other']);
    const admin = last.outputNotes.find((n) => classifyNote(n, tags) === 'admin')!;
    expect(admin.committed).toBe(true);
    expect(admin.attachmentSchemes.every((s) => s === 0)).toBe(true);
  });

  it('is "other" for everything when no faucet is configured', () => {
    const last = decodeTransactionRecord(records[records.length - 1], note_id_from_header);
    for (const n of last.outputNotes) expect(classifyNote(n, { faucetTag: null, feeFaucetTag: null })).toBe('other');
  });
});

describe('matchProposals / pendingProposalsExecutedOnChain', () => {
  it('ties a transaction to the local proposal whose admin note it carries, including erased notes', () => {
    const txs = sortNewestFirst(records.map((r) => decodeTransactionRecord(r, note_id_from_header)));
    const admin = txs[0].outputNotes[0];
    const erased = txs[0].outputNotes.find((n) => !n.committed)!;
    const known = new Map<string, KnownProposal>([
      [admin.noteIdHex, { proposalId: 'p-set-attester', description: 'Set attester', status: 'pending' }],
      [erased.noteIdHex, { proposalId: 'p-erased', description: 'Erased', status: 'executed' }],
      ['0xnope', { proposalId: 'p-none', description: 'Never on chain', status: 'pending' }],
    ]);

    const matches = matchProposals(txs, known);
    expect(matches.get(txs[0].txIdHex)?.map((m) => m.proposalId).sort()).toEqual(['p-erased', 'p-set-attester']);

    const executed = pendingProposalsExecutedOnChain(txs, known);
    expect(executed.map((m) => m.proposalId)).toEqual(['p-set-attester']);
    expect(executed[0].txIdHex).toBe(txs[0].txIdHex);
    expect(executed[0].blockNum).toBe(51088);
  });

  it('sorts newest first', () => {
    const txs = sortNewestFirst(records.map((r) => decodeTransactionRecord(r, note_id_from_header)));
    for (let i = 1; i < txs.length; i++) expect(txs[i - 1].blockNum).toBeGreaterThanOrEqual(txs[i].blockNum);
  });
});

describe('parseGrpcWebFrames', () => {
  const frame = (flag: number, payload: Uint8Array) => {
    const f = new Uint8Array(5 + payload.length);
    f[0] = flag;
    new DataView(f.buffer).setUint32(1, payload.length);
    f.set(payload, 5);
    return f;
  };
  const concat = (...parts: Uint8Array[]) => {
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let off = 0;
    for (const p of parts) {
      out.set(p, off);
      off += p.length;
    }
    return out;
  };

  it('returns the message frames and accepts an OK trailer', () => {
    const body = concat(frame(0, new Uint8Array([1, 2, 3])), frame(0x80, new TextEncoder().encode('grpc-status: 0\r\n')));
    const msgs = parseGrpcWebFrames(body);
    expect(msgs).toHaveLength(1);
    expect(Array.from(msgs[0])).toEqual([1, 2, 3]);
  });

  it('throws with the node message on a non-OK trailer', () => {
    const body = frame(0x80, new TextEncoder().encode('grpc-status: 3\r\ngrpc-message: block_to%20beyond%20tip\r\n'));
    expect(() => parseGrpcWebFrames(body)).toThrow(/grpc-status 3: block_to beyond tip/);
  });
});
