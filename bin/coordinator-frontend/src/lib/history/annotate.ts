import type { OnChainNote, OnChainTx } from './decode';

/**
 * Pure annotation of decoded on-chain transactions: what each output note is for, and which
 * locally-known proposals a transaction executed. No WASM, no network -- see `useOnChainHistory`
 * for where the inputs come from.
 */

/** What an output note of a multisig transaction is, judged by its target tag and attachments. */
export type NoteRole =
  /** An admin note addressed to the USDCx faucet. */
  | 'admin'
  /** The fee-sponsorship note bound (by attachment) to an admin note, also addressed to the faucet. */
  | 'fee_sponsorship'
  /** A note addressed to the chain's fee faucet. */
  | 'fee_payment'
  | 'other';

export interface TargetTags {
  /** `NoteTag::with_account_target(faucet)` as u32, or null when the faucet is not configured. */
  faucetTag: number | null;
  feeFaucetTag: number | null;
}

export function classifyNote(note: OnChainNote, tags: TargetTags): NoteRole {
  if (tags.faucetTag !== null && note.tag === tags.faucetTag) {
    return note.attachmentSchemes.some((s) => s !== 0) ? 'fee_sponsorship' : 'admin';
  }
  if (tags.feeFaucetTag !== null && note.tag === tags.feeFaucetTag) return 'fee_payment';
  return 'other';
}

export const NOTE_ROLE_LABEL: Record<NoteRole, string> = {
  admin: 'Admin note to the USDCx faucet',
  fee_sponsorship: 'Fee sponsorship for the admin note',
  fee_payment: 'Fee payment',
  other: 'Note',
};

/** A locally-known proposal, keyed by the id of the admin note it creates. */
export interface KnownProposal {
  proposalId: string;
  description: string;
  status: 'pending' | 'executed' | 'discarded';
}

export type KnownProposalIndex = ReadonlyMap<string, KnownProposal>;

export interface ProposalMatch extends KnownProposal {
  noteIdHex: string;
  txIdHex: string;
  blockNum: number;
}

/**
 * Finds, for every transaction, the locally-known proposals it executed: a proposal matches a
 * transaction when the admin note the proposal builds is among the transaction's output notes.
 * Works for erased notes too, since output notes are identified by id regardless of proof.
 */
export function matchProposals(txs: readonly OnChainTx[], known: KnownProposalIndex): Map<string, ProposalMatch[]> {
  const out = new Map<string, ProposalMatch[]>();
  for (const tx of txs) {
    for (const note of tx.outputNotes) {
      const k = known.get(note.noteIdHex);
      if (!k) continue;
      const list = out.get(tx.txIdHex) ?? [];
      list.push({ ...k, noteIdHex: note.noteIdHex, txIdHex: tx.txIdHex, blockNum: tx.blockNum });
      out.set(tx.txIdHex, list);
    }
  }
  return out;
}

/**
 * The proposals recorded locally as still `pending` whose admin note is already on chain in one
 * of the account's transactions -- i.e. executed from another browser, or executed here but never
 * marked (a custom proposal is never reported finalized by Guardian). The caller records these as
 * executed with the transaction that carried them.
 */
export function pendingProposalsExecutedOnChain(
  txs: readonly OnChainTx[],
  known: KnownProposalIndex,
): ProposalMatch[] {
  const result: ProposalMatch[] = [];
  const seen = new Set<string>();
  for (const matches of matchProposals(txs, known).values()) {
    for (const m of matches) {
      if (m.status !== 'pending' || seen.has(m.proposalId)) continue;
      seen.add(m.proposalId);
      result.push(m);
    }
  }
  return result;
}

/** Newest first, ties broken by the stable input order. */
export function sortNewestFirst<T extends { blockNum: number }>(txs: readonly T[]): T[] {
  return [...txs].sort((a, b) => b.blockNum - a.blockNum);
}
