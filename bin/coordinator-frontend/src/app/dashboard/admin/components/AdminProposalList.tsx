'use client';

import { useMemo } from 'react';
import type { Proposal } from '@openzeppelin/miden-multisig-client';
import { decodeRecipeLabel } from '@/lib/admin/recipe';
import { describeAdminRecipe } from '@/lib/admin/describe';
import { useAdminNoteConsumption } from '@/hooks/useAdminNoteConsumption';
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
  const state = useAdminNoteConsumption(proposal, recipe);

  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-[rgba(0,0,0,0.06)] last:border-0">
      <div className="min-w-0">
        <div className="text-[12px] font-[500] text-[#111] truncate">
          {recipe ? describeAdminRecipe(recipe).title : 'Unknown admin action'}
        </div>
        <div className="text-[11px] text-[rgba(0,0,0,0.45)] font-mono truncate" title={proposal.id}>
          {proposal.id.slice(0, 16)}…
        </div>
      </div>
      <span className={`shrink-0 text-[11px] font-[500] px-2 py-1 rounded-full ${STATE_COLORS[state]}`}>
        {STATE_LABELS[state]}
      </span>
    </div>
  );
}

/** Lifecycle status for every admin ('custom' proposalType) proposal: proposal-level state, and
 * once executed, whether the admin note it carries has actually been consumed at the faucet. */
export function AdminProposalList({ proposals }: { proposals: Proposal[] }) {
  const adminProposals = useMemo(
    () => proposals.filter((p) => p.metadata.proposalType === 'custom'),
    [proposals],
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
