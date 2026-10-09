'use client';

import type { Proposal } from '@openzeppelin/miden-multisig-client';
import { useMultisig } from '@/contexts/MultisigContext';
import { TokenAmount } from '@/components/TokenAmount';
import { describeSignerChange, shortHex } from '@/lib/proposalDescription';
import { decodeRecipeLabel, recipeContractStatus } from '@/lib/admin/recipe';
import { isAdminMode } from '@/config/appMode';
import { getAdminTargets } from '@/config/adminConfig';
import { describeAdminRecipe } from '@/lib/admin/describe';

/**
 * What a proposal does, from its metadata. The SDK checks the metadata against
 * the signed transaction summary and only lets verified proposals be signed or
 * executed, so this is what the signature commits to. Ledger shows only the
 * summary hash, which makes this the place to check the details.
 */
export function ProposalDetails({ proposal }: { proposal: Proposal }) {
  const { detectedConfig, consumableNotes } = useMultisig();
  const md = proposal.metadata;
  const verification = proposal.verification;

  let body: React.ReactNode;
  switch (md.proposalType) {
    case 'p2id':
      body = (
        <>
          Send <TokenAmount faucetId={md.faucetId} amount={md.amount} className="font-[600]" /> to{' '}
          <span className="font-mono" title={md.recipientId}>{shortHex(md.recipientId)}</span>
          {md.noteType === 'private' ? ' · private note' : ' · public note'}
          {md.timelockHeight !== undefined && ` · locked until block ${md.timelockHeight}`}
          {md.reclaimHeight !== undefined && ` · reclaimable after block ${md.reclaimHeight}`}
        </>
      );
      break;
    case 'consume_notes': {
      const known = consumableNotes.filter((n) => md.noteIds.includes(n.id));
      body = (
        <>
          Receive {md.noteIds.length} note{md.noteIds.length !== 1 ? 's' : ''}
          {known.flatMap((n) => n.assets).map((asset, i) => (
            <span key={`${asset.faucetId}-${i}`}>
              {i === 0 ? ': ' : ', '}
              <TokenAmount faucetId={asset.faucetId} amount={asset.amount} className="font-[600]" />
            </span>
          ))}
          {known.length < md.noteIds.length && ' (amounts of notes this browser has not synced are not shown)'}
        </>
      );
      break;
    }
    case 'add_signer':
    case 'remove_signer':
    case 'change_threshold': {
      const change = describeSignerChange(
        detectedConfig?.signerCommitments ?? [],
        detectedConfig?.threshold ?? 0,
        md.targetSignerCommitments,
        md.targetThreshold,
      );
      body = (
        <>
          {change.added.map((c) => <span key={`+${c}`}>Add signer <span className="font-mono" title={c}>{shortHex(c)}</span> · </span>)}
          {change.removed.map((c) => <span key={`-${c}`}>Remove signer <span className="font-mono" title={c}>{shortHex(c)}</span> · </span>)}
          Threshold {change.thresholdBefore}-of-{change.signersBefore} →{' '}
          <span className="font-[600]">{change.thresholdAfter}-of-{change.signersAfter}</span>
        </>
      );
      break;
    }
    case 'update_procedure_threshold':
      body = <>Set the {md.targetProcedure.replaceAll('_', ' ')} threshold to <span className="font-[600]">{md.targetThreshold}</span></>;
      break;
    case 'switch_guardian':
      body = (
        <>
          Switch Guardian to <span className="font-mono">{md.newGuardianEndpoint ?? 'an unknown endpoint'}</span>{' '}
          (key <span className="font-mono" title={md.newGuardianPubkey}>{shortHex(md.newGuardianPubkey)}</span>)
        </>
      );
      break;
    case 'custom': {
      const recipe = decodeRecipeLabel(md.rawProposalType);
      if (recipe) {
        const d = describeAdminRecipe(recipe);
        // The contract id comes from the label any proposer writes: flag one this console does not
        // administer (admin builds only; the wallet build configures no admin contracts).
        const unknown = isAdminMode && recipeContractStatus(recipe, getAdminTargets()) === 'unknown_contract';
        body = (
          <>
            <span className="font-[600]">{d.title}</span>
            {unknown && (
              <span className="ml-1.5 inline-block text-[11px] font-[500] px-2 py-0.5 rounded-full bg-red-50 text-red-700 font-mono break-all">
                Unknown contract {recipe.faucetId}
              </span>
            )}
            {d.lines.map((line, i) => <div key={i}>{line}</div>)}
          </>
        );
      } else {
        // Undecodable label: same message as the generic default below.
        body = <>Custom transaction: no decoded details are available for this type</>;
      }
      break;
    }
    default:
      body = <>Custom transaction: no decoded details are available for this type</>;
  }

  return (
    <div className="text-[11px] text-[rgba(0,0,0,0.65)] mt-0.5 break-words">
      {body}
      {verification.status === 'failed' && (
        <div className="text-red-600 mt-0.5">Not verified: {verification.message}</div>
      )}
    </div>
  );
}
