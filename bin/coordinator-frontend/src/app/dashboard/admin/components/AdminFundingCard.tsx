'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { TokenAmount, TokenSymbol } from '@/components/TokenAmount';
import { useDashboardUI } from '@/contexts/DashboardUIContext';
import { useMultisig } from '@/contexts/MultisigContext';
import { describeExecutionError } from '@/lib/errors';
import { getEffectiveThreshold } from '@/lib/procedures';

/**
 * Funding for the acting multisig. Every admin transaction pays a fee, and prepays the faucet's
 * fee for the note it sends, out of the multisig's own vault -- so the admin build has to be able
 * to receive funds even though it has no wallet home. Shows the balances, the notes waiting to be
 * received, and how many signatures receiving takes, with a one-off proposal to bring that down
 * to a single signer.
 */
export function AdminFundingCard() {
  const {
    multisig,
    detectedConfig,
    consumableNotes,
    proposals,
    creatingProposal,
    handleCreateProcedureThresholdProposal,
  } = useMultisig();
  const { openReceiveModal } = useDashboardUI();
  const [requesting, setRequesting] = useState(false);

  if (!multisig || !detectedConfig) return null;

  const balances = detectedConfig.vaultBalances;
  const signers = detectedConfig.signerCommitments.length;
  const receiveThreshold = getEffectiveThreshold(
    'consume_notes',
    detectedConfig.threshold,
    detectedConfig.procedureThresholds,
  );
  const changeThreshold = getEffectiveThreshold(
    'update_procedure_threshold',
    detectedConfig.threshold,
    detectedConfig.procedureThresholds,
  );
  const singleSignerPending = proposals.some(
    (p) =>
      p.status !== 'finalized' &&
      p.metadata.proposalType === 'update_procedure_threshold' &&
      p.metadata.targetProcedure === 'receive_asset' &&
      p.metadata.targetThreshold === 1,
  );

  const requestSingleSigner = async () => {
    setRequesting(true);
    try {
      await handleCreateProcedureThresholdProposal('receive_asset', 1);
    } catch (err) {
      toast.error(describeExecutionError(err, 'Could not create the threshold proposal'));
    } finally {
      setRequesting(false);
    }
  };

  return (
    <div className="rounded-[10px] border border-[rgba(0,0,0,0.08)] bg-white p-4 md:p-5 flex flex-col gap-4">
      <div className="text-[14px] font-[600] text-[#111]">Funding</div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <div className="text-[11px] font-[500] text-[rgba(0,0,0,0.45)]">Balance</div>
          {balances.length === 0 ? (
            <div className="text-[12px] text-[rgba(0,0,0,0.5)] mt-0.5">
              No funds yet. Admin transactions pay their fees from this multisig.
            </div>
          ) : (
            <div className="flex flex-col gap-0.5 mt-0.5">
              {balances.map((balance) => (
                <div key={balance.faucetId} className="text-[13px] font-[500] text-[#111]">
                  <TokenAmount faucetId={balance.faucetId} amount={balance.amount} />{' '}
                  <TokenSymbol faucetId={balance.faucetId} className="text-[rgba(0,0,0,0.5)]" />
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="text-[11px] font-[500] text-[rgba(0,0,0,0.45)]">Incoming notes</div>
          <div className="text-[13px] font-[500] text-[#111] mt-0.5">
            {consumableNotes.length === 0 ? 'None waiting' : `${consumableNotes.length} waiting to be received`}
          </div>
          <button
            type="button"
            onClick={() => openReceiveModal()}
            disabled={consumableNotes.length === 0}
            className="mt-2 h-9 px-3 rounded-[8px] bg-[#FF5500] hover:bg-[#E64A00] text-white text-[12px] font-[500] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Receive notes
          </button>
        </div>

        <div>
          <div className="text-[11px] font-[500] text-[rgba(0,0,0,0.45)]">Signatures to receive</div>
          <div className="text-[13px] font-[500] text-[#111] mt-0.5">
            {receiveThreshold} of {signers}
          </div>
          {receiveThreshold > 1 &&
            (singleSignerPending ? (
              <div className="mt-2 text-[12px] text-[rgba(0,0,0,0.5)]">
                A proposal to let a single signer receive is waiting for approval under Transactions.
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => void requestSingleSigner()}
                  disabled={requesting || creatingProposal}
                  className="mt-2 h-9 px-3 rounded-[8px] border border-[rgba(0,0,0,0.12)] text-[12px] font-[500] text-[#111] hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {requesting ? 'Creating proposal…' : 'Let a single signer receive'}
                </button>
                <div className="mt-1.5 text-[11px] text-[rgba(0,0,0,0.45)]">
                  One-off change that needs {changeThreshold} of {signers} approvals. It only affects receiving notes.
                </div>
              </>
            ))}
        </div>
      </div>
    </div>
  );
}
