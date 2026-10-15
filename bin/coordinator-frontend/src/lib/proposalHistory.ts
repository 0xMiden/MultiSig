import type { Proposal, ProposalType } from '@openzeppelin/miden-multisig-client';
import { decodeRecipeLabel } from '@/lib/admin/recipe';
import { describeAdminRecipe } from '@/lib/admin/describe';

/**
 * Durable, per-account proposal history.
 *
 * The console's live `proposals` list is Guardian's PENDING-ONLY view: Guardian
 * prunes a proposal the moment it is no longer pending, and custom (admin)
 * proposals never travel through Guardian's canonicalization at all (they
 * execute via a local submit). So the live list alone cannot answer "how many
 * proposals were there / how many executed / what was that one about" — once a
 * proposal executes it simply vanishes.
 *
 * This module keeps a small localStorage record, keyed by account, of every
 * proposal the client has observed, with its decoded human description and its
 * terminal status. It is the source of truth for the Transaction tab's counts
 * and recent-transaction rows. It is per-browser (like all of this app's
 * client state); a discard recorded here does not propagate to another signer's
 * browser — Guardian exposes no cross-signer delete/tombstone API.
 */

/** Terminal-or-pending lifecycle status tracked durably for a proposal. */
export type HistoryStatus = 'pending' | 'executed' | 'discarded';

export interface ProposalHistoryEntry {
  id: string;
  proposalType: ProposalType;
  /** The `usdcx_v1_…` label for custom proposals; used to re-decode the action. */
  rawProposalType?: string;
  /** Human-readable action, decoded once at record time (stable across prunes). */
  description: string;
  requiredSignatures: number;
  signatureCount: number;
  status: HistoryStatus;
  /** epoch ms when first observed by this browser. */
  createdAt: number;
  /** epoch ms of the last update. */
  updatedAt: number;
  /** Execution transaction id, when known. */
  txId?: string;
}

export interface HistoryStats {
  total: number;
  executed: number;
  pending: number;
  discarded: number;
  /** executed / total, as a whole-number percentage (0 when there are none). */
  successRate: number;
}

type HistoryMap = Record<string, ProposalHistoryEntry>;

const KEY_PREFIX = 'proposalHistory:';

function storageKey(accountId: string): string {
  return `${KEY_PREFIX}${accountId.toLowerCase()}`;
}

/**
 * A human-readable one-line description of any proposal: the built-in types map
 * to fixed labels, and a custom (admin) proposal is decoded from its recipe
 * label (`usdcx_v1_…`) into its real action (e.g. "Set max supply"). Pure and
 * SSR-safe. Never throws — an undecodable custom falls back to a generic label.
 */
export function describeProposal(proposal: Proposal): string {
  const md = proposal.metadata;
  switch (md.proposalType) {
    case 'p2id':
      return 'Send transaction';
    case 'consume_notes':
      return 'Receive transaction';
    case 'add_signer':
      return 'Add signer';
    case 'remove_signer':
      return 'Remove signer';
    case 'change_threshold':
      return 'Change threshold';
    case 'update_procedure_threshold':
      return 'Update procedure threshold';
    case 'switch_guardian':
      return 'Switch Guardian';
    case 'custom': {
      const recipe = decodeRecipeLabel(md.rawProposalType);
      if (!recipe) return 'Admin action';
      try {
        return describeAdminRecipe(recipe).title;
      } catch {
        return 'Admin action';
      }
    }
    default:
      return 'Unknown';
  }
}

/** Loads the full history map for an account. Returns `{}` on SSR or any failure. */
export function loadHistory(accountId: string | null | undefined): HistoryMap {
  if (!accountId || typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(storageKey(accountId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as HistoryMap;
  } catch {
    return {};
  }
}

/** Persists a history map. No-op (never throws) when storage is unavailable. */
function saveHistory(accountId: string, map: HistoryMap): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(accountId), JSON.stringify(map));
  } catch {
    // private mode / quota — history is in-memory for this session only.
  }
}

/**
 * Folds the current live proposal list into the stored history, returning the
 * updated map (and persisting it). Each observed proposal is upserted:
 * - a new id is recorded as `pending`;
 * - an existing entry keeps its terminal status (`executed`/`discarded`) — a
 *   live `pending` never overwrites a recorded terminal state, so an executed
 *   proposal that is briefly still listed does not revert — but its
 *   `signatureCount` is refreshed while it is still pending.
 *
 * Returns the merged map without mutating the input.
 */
export function recordObserved(
  accountId: string | null | undefined,
  proposals: readonly Proposal[],
  now: number = Date.now(),
): HistoryMap {
  if (!accountId) return {};
  const map: HistoryMap = { ...loadHistory(accountId) };
  for (const p of proposals) {
    const existing = map[p.id];
    const description = describeProposal(p);
    const signatureCount = p.signatures?.length ?? 0;
    const requiredSignatures = p.metadata.requiredSignatures ?? existing?.requiredSignatures ?? 0;
    const rawProposalType = p.metadata.proposalType === 'custom' ? p.metadata.rawProposalType : undefined;
    if (!existing) {
      map[p.id] = {
        id: p.id,
        proposalType: p.metadata.proposalType,
        rawProposalType,
        description,
        requiredSignatures,
        signatureCount,
        status: p.status === 'finalized' ? 'executed' : 'pending',
        createdAt: now,
        updatedAt: now,
      };
      continue;
    }
    // Keep a recorded terminal status; only refresh live fields while pending.
    const nextStatus: HistoryStatus =
      existing.status === 'pending' && p.status === 'finalized' ? 'executed' : existing.status;
    map[p.id] = {
      ...existing,
      description,
      rawProposalType: rawProposalType ?? existing.rawProposalType,
      requiredSignatures,
      signatureCount: existing.status === 'pending' ? signatureCount : existing.signatureCount,
      status: nextStatus,
      updatedAt: now,
    };
  }
  saveHistory(accountId, map);
  return map;
}

/** Marks a proposal `executed` (recording its tx id when known) and persists. */
export function recordExecuted(
  accountId: string | null | undefined,
  proposalId: string,
  txId?: string,
  now: number = Date.now(),
): HistoryMap {
  return patchEntry(accountId, proposalId, { status: 'executed', txId }, now);
}

/** Marks a proposal `discarded` (locally cancelled / abandoned) and persists. */
export function recordDiscarded(
  accountId: string | null | undefined,
  proposalId: string,
  now: number = Date.now(),
): HistoryMap {
  return patchEntry(accountId, proposalId, { status: 'discarded' }, now);
}

function patchEntry(
  accountId: string | null | undefined,
  proposalId: string,
  patch: Partial<ProposalHistoryEntry>,
  now: number,
): HistoryMap {
  if (!accountId) return {};
  const map: HistoryMap = { ...loadHistory(accountId) };
  const existing = map[proposalId];
  if (existing) {
    map[proposalId] = { ...existing, ...patch, updatedAt: now };
    saveHistory(accountId, map);
  }
  return map;
}

/** Newest-first array view of a history map. */
export function historyEntries(map: HistoryMap): ProposalHistoryEntry[] {
  return Object.values(map).sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Totals for the Transaction-tab summary cards. `total` counts every recorded
 * proposal (executed, pending, and discarded); `pending` is those still
 * awaiting signatures/execution; `successRate` is executed/total. A discarded
 * (stuck, never-executed) proposal therefore counts against the rate, which is
 * the honest reading.
 */
export function historyStats(map: HistoryMap): HistoryStats {
  return statsFromEntries(Object.values(map));
}

/** Same totals as {@link historyStats}, computed from an entries array. */
export function statsFromEntries(entries: readonly ProposalHistoryEntry[]): HistoryStats {
  const total = entries.length;
  const executed = entries.filter((e) => e.status === 'executed').length;
  const pending = entries.filter((e) => e.status === 'pending').length;
  const discarded = entries.filter((e) => e.status === 'discarded').length;
  const successRate = total > 0 ? Math.round((executed / total) * 100) : 0;
  return { total, executed, pending, discarded, successRate };
}
