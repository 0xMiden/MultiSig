'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useMultisig } from '@/contexts/MultisigContext';
import { getAdminConfig } from '@/config/adminConfig';
import type { AdminAction, AdminActionArgs, AdminRecipe } from '@/lib/admin/recipe';
import { describeAdminRecipe } from '@/lib/admin/describe';
import { runGuardrails, type GuardrailResult } from '@/lib/admin/guardrails';
import { ValidationError } from '@/lib/admin/validation';
import { describeExecutionError } from '@/lib/errors';
import { accountIdHexFromBech32, type ActionSender } from '@/lib/admin/directAction';
import { shortFaucetId } from '@/lib/tokenAmounts';
import type { FaucetBytesState } from '@/hooks/useAdminTargets';

type Step = 'form' | 'warn' | 'review';

export interface AdminActionCardProps {
  action: AdminAction;
  title: string;
  description?: string;
  /** Faucet bytes for `runGuardrails` -- not ready yet or failed to load both block submission. */
  faucetBytesState: FaucetBytesState;
  /** Other not-yet-finalized admin proposals, for the revoke-in-flight guardrail. */
  inflightRecipes: AdminRecipe[];
  /**
   * Who sends the action. `multisig` (the default) creates a proposal the multisig's signers
   * co-sign and execute. `bread` sends it straight from the account connected through Bread,
   * which then holds the action's role itself: Bread signs and submits, there is no proposal.
   */
  sender?: ActionSender;
  /** Validates the current field state and builds this action's args, or throws `ValidationError`. */
  buildArgs: () => AdminActionArgs;
  /** Called after a successful `handleCreateAdminProposal`, so the caller can clear its fields. */
  onSubmitted?: () => void;
  submitLabel?: string;
  /** The form's field inputs. Shown only in the `form` step -- once guardrails/review take over,
   * the already-validated args are frozen in the recipe, and "Cancel" returns here unchanged. */
  children: React.ReactNode;
}

/**
 * Shared engine behind every admin action form: validate -> guardrails -> (warn confirm) ->
 * review (the same `describeAdminRecipe` summary co-signers see) -> `handleCreateAdminProposal`.
 * A `block` guardrail disables submission entirely; a `warn` requires typing "CONFIRM" before
 * the review step is reached.
 */
export function AdminActionCard({
  action,
  title,
  description,
  faucetBytesState,
  inflightRecipes,
  buildArgs,
  onSubmitted,
  submitLabel,
  children,
  sender = 'multisig',
}: AdminActionCardProps) {
  const { multisig, midenWalletSession, handleCreateAdminProposal, handleDirectAdminAction } = useMultisig();
  const direct = sender === 'bread';
  const breadAddress = midenWalletSession.connected ? (midenWalletSession.address ?? null) : null;
  // The Bread account's id (hex); `null` when Bread is not connected or its address does not parse.
  const breadAccountId = useMemo(() => {
    try {
      return breadAddress ? accountIdHexFromBech32(breadAddress) : null;
    } catch {
      return null;
    }
  }, [breadAddress]);
  const [step, setStep] = useState<Step>('form');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [guardrail, setGuardrail] = useState<GuardrailResult | null>(null);
  const [recipe, setRecipe] = useState<AdminRecipe | null>(null);
  const [warnConfirmText, setWarnConfirmText] = useState('');
  const [checkingGuardrails, setCheckingGuardrails] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setStep('form');
    setFieldError(null);
    setGuardrail(null);
    setRecipe(null);
    setWarnConfirmText('');
  };

  const handleContinue = async () => {
    setFieldError(null);
    setGuardrail(null);
    let senderAccountId: string;
    if (direct) {
      if (!breadAccountId) {
        setFieldError('Connect Bread first');
        return;
      }
      senderAccountId = breadAccountId;
    } else {
      if (!multisig) {
        setFieldError('Load an account first');
        return;
      }
      senderAccountId = multisig.accountId;
    }

    let actionArgs: AdminActionArgs;
    try {
      actionArgs = buildArgs();
    } catch (err) {
      setFieldError(err instanceof ValidationError || err instanceof Error ? err.message : 'Invalid input');
      return;
    }

    const cfg = getAdminConfig();
    const draft: AdminRecipe = {
      recipeVersion: 1,
      action,
      actionArgs,
      senderAccountId,
      faucetId: cfg.faucetId,
      feeFaucetId: cfg.feeFaucetId,
      networkId: cfg.networkId,
      saltHex: '',
      boundBlockNum: 0,
    };
    setRecipe(draft);

    if (faucetBytesState.status !== 'ready') {
      setGuardrail({
        level: 'block',
        message:
          faucetBytesState.status === 'error'
            ? `Could not evaluate guardrails: ${faucetBytesState.message}`
            : 'Still loading faucet state needed to evaluate guardrails. Try again in a moment.',
      });
      return;
    }

    setCheckingGuardrails(true);
    try {
      const result = await runGuardrails(faucetBytesState.bytes, draft, inflightRecipes);
      setGuardrail(result);
      if (result.level === 'block') return;
      setStep(result.level === 'warn' ? 'warn' : 'review');
    } catch (err) {
      setFieldError(err instanceof Error ? err.message : 'Could not evaluate guardrails');
    } finally {
      setCheckingGuardrails(false);
    }
  };

  const handleSubmit = async () => {
    if (!recipe) return;
    setSubmitting(true);
    try {
      if (direct) {
        const txId = await handleDirectAdminAction(recipe);
        toast.success(`${title}: submitted by Bread (tx ${shortFaucetId(txId)}). The faucet applies it in a few blocks.`);
      } else {
        await handleCreateAdminProposal(recipe);
      }
      reset();
      onSubmitted?.();
    } catch (err) {
      toast.error(
        describeExecutionError(
          err,
          direct ? `Failed to ${title.toLowerCase()} via Bread` : `Failed to create the ${title.toLowerCase()} proposal`,
        ),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const blocked = guardrail?.level === 'block';
  const described = recipe ? describeAdminRecipe(recipe) : null;

  return (
    <div className="rounded-[10px] border border-[rgba(0,0,0,0.08)] p-4 md:p-5 bg-white flex flex-col gap-3">
      <div>
        <div className="flex items-center justify-between gap-2">
          <div className="text-[14px] font-[600] text-[#111]">{title}</div>
          {direct && (
            <span
              className="text-[11px] font-[500] px-2 py-0.5 rounded-full bg-[#FF5500]/10 text-[#C24400] whitespace-nowrap"
              title={breadAddress ?? ''}
            >
              Direct via Bread{breadAccountId ? ` · ${shortFaucetId(breadAccountId)}` : ''}
            </span>
          )}
        </div>
        {description && <div className="text-[12px] text-[rgba(0,0,0,0.5)] mt-0.5">{description}</div>}
      </div>

      {step === 'form' && (
        <>
          <div className="flex flex-col gap-3">{children}</div>
          {fieldError && (
            <div role="alert" className="rounded-[8px] border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-600">
              {fieldError}
            </div>
          )}
          {blocked && guardrail && (
            <div role="alert" className="rounded-[8px] border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-600">
              {guardrail.message}
            </div>
          )}
          <button
            type="button"
            onClick={() => void handleContinue()}
            disabled={checkingGuardrails}
            className="h-10 rounded-[8px] bg-[#FF5500] hover:bg-[#E64A00] text-white text-[13px] font-[500] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {checkingGuardrails ? 'Checking…' : (submitLabel ?? 'Continue')}
          </button>
        </>
      )}

      {step === 'warn' && guardrail?.level === 'warn' && (
        <div className="flex flex-col gap-3">
          <div role="alert" className="rounded-[8px] border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
            {guardrail.message}
          </div>
          <label className="text-[12px] font-[500] text-[rgba(0,0,0,0.5)]">Type CONFIRM to proceed</label>
          <input
            type="text"
            value={warnConfirmText}
            onChange={(e) => setWarnConfirmText(e.target.value)}
            className="w-full h-10 rounded-[8px] border border-[rgba(0,0,0,0.08)] px-3 text-[12px] text-[#111] focus:outline-hidden focus:ring-1 focus:ring-[#FF5500] bg-white"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={reset}
              className="flex-1 h-10 rounded-[8px] border border-[rgba(0,0,0,0.08)] text-[13px] font-[500] text-[rgba(0,0,0,0.6)] hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => setStep('review')}
              disabled={warnConfirmText.trim() !== 'CONFIRM'}
              className="flex-[2] h-10 rounded-[8px] bg-[#FF5500] hover:bg-[#E64A00] text-white text-[13px] font-[500] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {step === 'review' && recipe && described && (
        <div className="flex flex-col gap-3">
          <div className="rounded-[8px] border border-[rgba(0,0,0,0.08)] bg-[#f9f9f9] px-3 py-2.5">
            <div className="text-[12px] font-[600] text-[#111]">{described.title}</div>
            {described.lines.map((line, i) => (
              <div key={i} className="text-[12px] text-[rgba(0,0,0,0.65)] mt-0.5 break-all">
                {line}
              </div>
            ))}
          </div>
          <div className="text-[11px] text-[rgba(0,0,0,0.45)]">
            {direct
              ? 'Bread will ask you to confirm this transaction. Your Bread account signs and submits it directly; there is no proposal to co-sign.'
              : 'This is the same summary co-signers will see before approving.'}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={reset}
              disabled={submitting}
              className="flex-1 h-10 rounded-[8px] border border-[rgba(0,0,0,0.08)] text-[13px] font-[500] text-[rgba(0,0,0,0.6)] hover:bg-gray-50 transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={submitting}
              className="flex-[2] h-10 rounded-[8px] bg-[#28A857] hover:bg-[#239E4C] text-white text-[13px] font-[500] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {direct ? (submitting ? 'Waiting for Bread…' : 'Sign with Bread') : submitting ? 'Creating…' : 'Create Proposal'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
