'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Endpoint, Note, NoteId, RpcClient } from '@miden-sdk/miden-sdk';
import { MIDEN_RPC_URL } from '@/config/psm';
import { getAdminConfig } from '@/config/adminConfig';
import { account_target_tag, admin_note_kinds, note_id_from_header } from '@/lib/usdcxAdminWasm/usdcx_admin_notes';
import { buildAdminNoteBytes, initAdminWasm } from '@/lib/admin/noteBuilders';
import { decodeRecipeLabel } from '@/lib/admin/recipe';
import { getNetworkNoteConsumption, type NetworkNoteConsumption } from '@/lib/admin/consumption';
import type { ProposalHistoryEntry } from '@/lib/proposalHistory';
import { decodeTransactionRecord, type OnChainNote, type OnChainTx } from '@/lib/history/decode';
import {
  classifyNote,
  matchProposals,
  noteContract,
  pendingProposalsExecutedOnChain,
  sortNewestFirst,
  type KnownProposal,
  type KnownProposalIndex,
  type NoteContract,
  type NoteRole,
  type ProposalMatch,
  type TargetTags,
} from '@/lib/history/annotate';
import { fetchAccountTransactions } from '@/lib/history/nodeRpc';

export interface HistoryNote extends OnChainNote {
  role: NoteRole;
  /** The administered contract the note is addressed to, if any. */
  contract: NoteContract | null;
  /** The admin action named by the note's script root, for committed public admin notes. */
  kind?: string;
  /** The faucet's (ntx-builder's) verdict on an admin note, when the node has one. */
  consumption?: NetworkNoteConsumption;
}

export interface HistoryTx extends OnChainTx {
  /** Unix seconds of the block, once its header has been fetched. */
  timestamp?: number;
  notes: HistoryNote[];
  /** Locally-known proposals this transaction executed (matched by admin note id). */
  proposals: ProposalMatch[];
}

export type OnChainHistoryState =
  | { status: 'idle' }
  | { status: 'loading'; txs: HistoryTx[] }
  | { status: 'ready'; txs: HistoryTx[]; chainTip: number; fetchedAt: number }
  | { status: 'error'; message: string; txs: HistoryTx[] };

export interface OnChainHistory {
  state: OnChainHistoryState;
  /** Pending local proposals whose admin note is on chain -- see `pendingProposalsExecutedOnChain`. */
  executedOnChain: ProposalMatch[];
  refresh: () => void;
}

const IDLE: OnChainHistoryState = { status: 'idle' };

let rpc: RpcClient | undefined;
function rpcClient(): RpcClient {
  if (!rpc) rpc = new RpcClient(new Endpoint(MIDEN_RPC_URL));
  return rpc;
}

function targetTags(): TargetTags {
  const cfg = getAdminConfig();
  const tag = (id: string): number | null => {
    try {
      return id ? account_target_tag(id) : null;
    } catch {
      return null;
    }
  };
  return { faucetTag: tag(cfg.faucetId), bridgeTag: tag(cfg.bridgeId), feeFaucetTag: tag(cfg.feeFaucetId) };
}

/** Script root hex -> admin action label, from the vendored crate. */
function noteKindsByRoot(): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of admin_note_kinds()) {
    const sep = entry.indexOf('|');
    if (sep > 0) map.set(entry.slice(sep + 1).toLowerCase(), entry.slice(0, sep));
  }
  return map;
}

/**
 * Indexes the locally-known custom proposals by the id of the admin note each one builds. The
 * recipe label (`usdcx_v1_…` / `agg_v1_…`) carries everything needed to rebuild the note, so this needs no
 * per-browser recipe store and names notes created from any browser.
 */
export function indexKnownProposals(entries: readonly ProposalHistoryEntry[]): KnownProposalIndex {
  const index = new Map<string, KnownProposal>();
  for (const e of entries) {
    if (e.proposalType !== 'custom' || !e.rawProposalType) continue;
    const recipe = decodeRecipeLabel(e.rawProposalType);
    if (!recipe) continue;
    try {
      const noteIdHex = Note.deserialize(buildAdminNoteBytes(recipe)).id().toString().toLowerCase();
      index.set(noteIdHex, { proposalId: e.id, description: e.description, status: e.status });
    } catch {
      // A label this build cannot rebuild (older recipe version) simply stays unmatched.
    }
  }
  return index;
}

/**
 * The account's on-chain transaction history, straight from the node: every transaction the
 * account executed (block, id, state commitments, notes consumed and created), with each output
 * note identified by id, classified (admin note / fee sponsorship / fee payment), named by its
 * script root where the node still holds it, given the faucet's consumption verdict, and tied
 * back to the locally-known proposal that created it.
 *
 * Also yields `executedOnChain`: local proposals still recorded `pending` whose admin note is in
 * one of these transactions, so the caller can mark them executed -- the on-chain record is the
 * one source that does not depend on which browser pressed Execute.
 */
export function useOnChainHistory(
  accountIdHex: string | null,
  entries: readonly ProposalHistoryEntry[],
): OnChainHistory {
  const [state, setState] = useState<OnChainHistoryState>(IDLE);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);
  const latest = useRef(0);

  // The known-proposal index depends on the WASM being initialized; it is rebuilt inside the
  // effect once that is guaranteed, keyed on the entries' identity-relevant fields only.
  const entriesKey = useMemo(
    () => entries.map((e) => `${e.id}:${e.status}:${e.rawProposalType ?? ''}`).join('|'),
    [entries],
  );

  useEffect(() => {
    if (!accountIdHex) {
      setState(IDLE);
      return;
    }
    const run = ++latest.current;
    const stale = () => run !== latest.current;
    setState((prev) => ({ status: 'loading', txs: 'txs' in prev ? prev.txs : [] }));

    (async () => {
      try {
        await initAdminWasm();
        const { chainTip, records } = await fetchAccountTransactions(accountIdHex);
        if (stale()) return;

        const tags = targetTags();
        const known = indexKnownProposals(entries);
        const decoded = sortNewestFirst(records.map((r) => decodeTransactionRecord(r, note_id_from_header)));
        const matches = matchProposals(decoded, known);
        const txs: HistoryTx[] = decoded.map((tx) => ({
          ...tx,
          notes: tx.outputNotes.map((n) => ({ ...n, role: classifyNote(n, tags), contract: noteContract(n, tags) })),
          proposals: matches.get(tx.txIdHex) ?? [],
        }));
        setState({ status: 'ready', txs, chainTip, fetchedAt: Date.now() });

        // Enrichment, best effort and incremental: block timestamps, admin-note kinds (script
        // roots of committed public notes) and the faucet's verdict on each admin note.
        const client = rpcClient();
        const kinds = noteKindsByRoot();
        const patch = (update: (tx: HistoryTx) => HistoryTx) => {
          if (stale()) return;
          setState((prev) => ('txs' in prev ? { ...prev, txs: prev.txs.map(update) } : prev));
        };

        for (const block of new Set(txs.map((t) => t.blockNum))) {
          try {
            const header = await client.getBlockHeaderByNumber(block, false);
            const timestamp = header.timestamp();
            patch((tx) => (tx.blockNum === block ? { ...tx, timestamp } : tx));
          } catch {
            // No timestamp for this block; the block number still shows.
          }
          if (stale()) return;
        }

        for (const tx of txs) {
          for (const note of tx.notes) {
            if (note.role !== 'admin' && note.role !== 'other') continue;
            let kind: string | undefined;
            if (note.committed && note.isPublic) {
              try {
                const [fetched] = await client.getNotesById([NoteId.fromHex(note.noteIdHex)]);
                const full = fetched?.asInputNote()?.note();
                if (full) kind = kinds.get(full.script().root().toHex().toLowerCase());
              } catch {
                // The node no longer serves the note; the role label still applies.
              }
            }
            let consumption: NetworkNoteConsumption | undefined;
            if (note.role === 'admin' && note.committed) {
              try {
                const c = await getNetworkNoteConsumption(note.noteIdHex);
                if (c !== 'not_found') consumption = c;
              } catch {
                // Status unknown; shown as such.
              }
            }
            if (stale()) return;
            if (kind !== undefined || consumption !== undefined) {
              patch((t) =>
                t.txIdHex !== tx.txIdHex
                  ? t
                  : {
                      ...t,
                      notes: t.notes.map((n) =>
                        n.noteIdHex === note.noteIdHex
                          ? { ...n, ...(kind !== undefined ? { kind } : {}), ...(consumption ? { consumption } : {}) }
                          : n,
                      ),
                    },
              );
            }
          }
        }
      } catch (err) {
        if (stale()) return;
        const message = err instanceof Error ? err.message : String(err);
        setState((prev) => ({ status: 'error', message, txs: 'txs' in prev ? prev.txs : [] }));
      }
    })();
    // `entries` is captured via `entriesKey` so a re-render with an equal list does not refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountIdHex, tick, entriesKey]);

  const executedOnChain = useMemo(() => {
    if (!('txs' in state) || state.txs.length === 0) return [];
    const known = new Map<string, KnownProposal>();
    for (const tx of state.txs) for (const m of tx.proposals) known.set(m.noteIdHex, m);
    return pendingProposalsExecutedOnChain(state.txs, known);
  }, [state]);

  return { state, executedOnChain, refresh };
}
