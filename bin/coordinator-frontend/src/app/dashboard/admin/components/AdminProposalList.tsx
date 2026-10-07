'use client';

import { useMemo } from 'react';
import type { Proposal } from '@openzeppelin/miden-multisig-client';
import { decodeRecipeLabel } from '@/lib/admin/recipe';
import { describeAdminRecipe } from '@/lib/admin/describe';
import { useAdminNoteConsumption } from '@/hooks/useAdminNoteConsumption';
import { useMultisig } from '@/contexts/MultisigContext';
import type { ConsumptionState } from '@/lib/admin/consumption';

const STATE_LABELS: Record<ConsumptionState, string> = {
  created: 'Created',
  collecting: 'Collecting signatures',
  threshold_reached: 'Ready to execute',
  executed: 'Executed',
  awaiting_consumption: 'Awaiting note consumption',
  applied: 'Applied',
  failed: 'Failed',
};

const STATE_COLORS: Record<ConsumptionState, string> = {
  created: 'bg-gray-100 text-gray-600',
  collecting: 'bg-gray-100 text-gray-600',
  threshold_reached: 'bg-blue-50 text-blue-700',
  executed: 'bg-amber-50 text-amber-800',
  awaiting_consumption: 'bg-amber-50 text-amber-800',
  applied: 'bg-[#28A857]/10 text-[#1F7A3F]',
  failed: 'bg-red-50 text-red-700',
};

/**
 * One admin proposal's row: decodes its recipe once (memoized on the raw label string itself, NOT
 * on `proposal.metadata`, which is a fresh object every sync) so the recipe object identity is
 * stable across re-renders and `useAdminNoteConsumption`'s polling effect doesn't tear down and
 * restart on every render.
 */
function AdminProposalRow({ proposal }: { proposal: Proposal }) {
  const rawProposalType = proposal.metadata.proposalType === 'custom' ? proposal.metadata.rawProposalType : null;
  // Keyed on the raw label string alone (not `proposal.metadata`, a fresh object every sync, and
  // not `proposal.id`, which eslint correctly flags as redundant: each row is one component
  // instance per id via the list's `key`, so `proposal.id` never changes within it).
  const recipe = useMemo(() => (rawProposalType ? decodeRecipeLabel(rawProposalType) : null), [rawProposalType]);
  const { state, detail } = useAdminNoteConsumption(proposal, recipe);
  const { handleCancelProposal, cancelingProposal, handleExecuteProposal, executingProposal } = useMultisig();

  // A fully-signed admin proposal that never executed (or whose execution did
  // not land) can be retried — this re-syncs and re-executes at the current
  // chain tip. If its signed block binding has since expired, the retry fails
  // the same way and Discard is the resolution. Retry does nothing useful once
  // the action has actually applied.
  const canRetry = state === 'threshold_reached' || state === 'failed' || state === 'awaiting_consumption';
  const isRetrying = executingProposal === proposal.id;

  return (
    <div className="py-2.5 border-b border-[rgba(0,0,0,0.06)] last:border-0">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[12px] font-[500] text-[#111] truncate">
            {recipe ? describeAdminRecipe(recipe).title : 'Unknown admin action'}
          </div>
          <div className="text-[11px] text-[rgba(0,0,0,0.45)] font-mono truncate" title={proposal.id}>
            {proposal.id.slice(0, 16)}…
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[11px] font-[500] px-2 py-1 rounded-full ${STATE_COLORS[state]}`}>
            {STATE_LABELS[state]}
          </span>
          {canRetry && (
            <button
              type="button"
              onClick={() => handleExecuteProposal(proposal.id).catch(() => {})}
              disabled={isRetrying || cancelingProposal === proposal.id}
              title="Retry: re-sync and re-execute this fully-signed proposal at the current chain tip"
              className="text-[11px] font-[500] text-[#FF5500] hover:text-[#cc4400] disabled:opacity-50 cursor-pointer"
            >
              {isRetrying ? '…' : 'Retry'}
            </button>
          )}
          {state !== 'applied' && (
            <button
              type="button"
              onClick={() => handleCancelProposal(proposal.id)}
              disabled={cancelingProposal === proposal.id || isRetrying}
              title="Discard this request: release any account lock and record it as discarded (this browser only — Guardian cannot propagate a discard to other signers)"
              className="text-[11px] font-[500] text-red-600 hover:text-red-700 disabled:opacity-50 cursor-pointer"
            >
              {cancelingProposal === proposal.id ? '…' : 'Discard'}
            </button>
          )}
        </div>
      </div>
      {detail && (
        // The faucet's own execution error for this note, from the node's network-tx-builder. Shown
        // whether the note has been `failed` (discarded) or is still being retried — a deterministic
        // rejection (e.g. "new max supply is less than current token supply") may be retried
        // indefinitely without ever being discarded, so this is often the only place the user sees why.
        <div
          className={`mt-1.5 text-[11px] leading-snug break-words rounded-[6px] px-2 py-1 ${
            state === 'failed' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'
          }`}
        >
          <span className="font-[600]">Faucet rejected the note:</span> {detail}
        </div>
      )}
    </div>
  );
}

/** Lifecycle status for every admin ('custom' proposalType) proposal: proposal-level state, and
 * once executed, whether the admin note it carries has actually been consumed at the faucet. */
export function AdminProposalList({ proposals }: { proposals: Proposal[] }) {
  const { dismissedProposalIds } = useMultisig();
  const adminProposals = useMemo(
    () => proposals.filter((p) => p.metadata.proposalType === 'custom' && !dismissedProposalIds.has(p.id)),
    [proposals, dismissedProposalIds],
  );

  if (adminProposals.length === 0) return null;

  return (
    <div className="rounded-[10px] border border-[rgba(0,0,0,0.08)] p-4 md:p-5 bg-white">
      <div className="text-[14px] font-[600] text-[#111] mb-1">Admin proposals</div>
      <div className="flex flex-col">
        {adminProposals.map((proposal) => (
          <AdminProposalRow key={proposal.id} proposal={proposal} />
        ))}
      </div>
    </div>
  );
}
