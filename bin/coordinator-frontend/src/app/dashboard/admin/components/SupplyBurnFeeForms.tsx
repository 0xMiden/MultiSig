'use client';

import { useEffect, useState } from 'react';
import { AdminActionCard } from './AdminActionCard';
import { Field, textInputClass, readOnlyInputClass } from './fields';
import { parseU64, parseMinBurn, parseNoteScriptRoot, ValidationError } from '@/lib/admin/validation';
import { getAdminConfig } from '@/config/adminConfig';
import { shortFaucetId, groupDigits } from '@/lib/tokenAmounts';
import type { AdminRecipe } from '@/lib/admin/recipe';
import type { ActionSender } from '@/lib/admin/directAction';
import type { FaucetBytesState } from '@/hooks/useAdminTargets';
import { useFaucetConfig } from '@/hooks/useFaucetConfig';
import { initAdminWasm, readNoteFee } from '@/lib/admin/noteBuilders';
import { ACTION_INFO } from '@/lib/admin/roles';

interface GroupProps {
  faucetBytesState: FaucetBytesState;
  inflightRecipes: AdminRecipe[];
  /** Who sends the action: the acting multisig (a proposal) or the connected Bread account. */
  sender?: ActionSender;
}

/** ADMIN-gated: set the faucet's max issuable supply, in base units. */
export function SetMaxSupplyForm({ faucetBytesState, inflightRecipes, sender }: GroupProps) {
  const [maxSupply, setMaxSupply] = useState('');
  const current = useFaucetConfig(faucetBytesState);

  return (
    <AdminActionCard
      action="set_max_supply"
      title={ACTION_INFO.set_max_supply.title}
      description={ACTION_INFO.set_max_supply.description}
      faucetBytesState={faucetBytesState}
      inflightRecipes={inflightRecipes}
      sender={sender}
      buildArgs={() => {
        const value = parseU64(maxSupply);
        // The faucet rejects a new max supply below what it has already issued
        // (ERR_NEW_MAX_SUPPLY_BELOW_TOKEN_SUPPLY). Catch it here -- before a proposal is created,
        // signed and executed -- rather than letting it fail silently at note consumption.
        if (current && value < BigInt(current.tokenSupply)) {
          throw new ValidationError(
            `Can't be less than current token supply of ${groupDigits(current.tokenSupply)} base units`,
          );
        }
        return { action: 'set_max_supply', maxSupply: value.toString() };
      }}
      onSubmitted={() => setMaxSupply('')}
    >
      <Field
        label="New max supply (base units)"
        hint={
          current
            ? `Current: ${groupDigits(current.maxSupply)} · can't be below current token supply of ${groupDigits(current.tokenSupply)}`
            : undefined
        }
      >
        <input
          type="text"
          value={maxSupply}
          onChange={(e) => setMaxSupply(e.target.value)}
          placeholder="0"
          className={textInputClass}
        />
      </Field>
    </AdminActionCard>
  );
}

/** ADMIN-gated: set the faucet's minimum burn amount, in base units. */
export function SetMinBurnForm({ faucetBytesState, inflightRecipes, sender }: GroupProps) {
  const [minBurn, setMinBurn] = useState('');
  const current = useFaucetConfig(faucetBytesState);

  return (
    <AdminActionCard
      action="set_min_burn"
      title={ACTION_INFO.set_min_burn.title}
      description={ACTION_INFO.set_min_burn.description}
      faucetBytesState={faucetBytesState}
      inflightRecipes={inflightRecipes}
      sender={sender}
      buildArgs={() => ({ action: 'set_min_burn', minBurn: parseMinBurn(minBurn).toString() })}
      onSubmitted={() => setMinBurn('')}
    >
      <Field
        label="New min burn (base units)"
        hint={current ? `Current: ${current.minBurn}` : undefined}
      >
        <input
          type="text"
          value={minBurn}
          onChange={(e) => setMinBurn(e.target.value)}
          placeholder="1"
          className={textInputClass}
        />
      </Field>
    </AdminActionCard>
  );
}

/** ADMIN-gated: set the note script root and fee that must be paid for a note type. The fee
 * faucet is always the chain's native fee faucet -- never editable. */
export function SetNoteFeeForm({ faucetBytesState, inflightRecipes, sender }: GroupProps) {
  const [noteScriptRoot, setNoteScriptRoot] = useState('');
  const [feeAmount, setFeeAmount] = useState('');
  const [currentFee, setCurrentFee] = useState<string | null>(null);
  const cfg = getAdminConfig();

  // The fee is per note-script, so it only resolves once a valid root is entered.
  useEffect(() => {
    const validRoot = /^0x[0-9a-fA-F]{64}$/.test(noteScriptRoot.trim());
    if (faucetBytesState.status !== 'ready' || !validRoot) {
      setCurrentFee(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await initAdminWasm();
        const fee = readNoteFee(faucetBytesState.bytes, noteScriptRoot.trim());
        if (!cancelled) setCurrentFee(fee === null ? 'not set (free)' : fee.toString());
      } catch {
        if (!cancelled) setCurrentFee(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [faucetBytesState, noteScriptRoot]);

  return (
    <AdminActionCard
      action="set_note_fee"
      title={ACTION_INFO.set_note_fee.title}
      description={ACTION_INFO.set_note_fee.description}
      faucetBytesState={faucetBytesState}
      inflightRecipes={inflightRecipes}
      sender={sender}
      buildArgs={() => ({
        action: 'set_note_fee',
        noteScriptRoot: parseNoteScriptRoot(noteScriptRoot),
        feeAmount: parseU64(feeAmount).toString(),
      })}
      onSubmitted={() => {
        setNoteScriptRoot('');
        setFeeAmount('');
      }}
    >
      <Field label="Note script root (64 hex chars)">
        <input
          type="text"
          value={noteScriptRoot}
          onChange={(e) => setNoteScriptRoot(e.target.value)}
          placeholder="0x…"
          className={textInputClass}
        />
      </Field>
      <Field label="Fee faucet" hint="Always the chain's native fee faucet -- read-only.">
        <input type="text" readOnly value={cfg.feeFaucetId ? shortFaucetId(cfg.feeFaucetId) : 'Not configured'} className={readOnlyInputClass} />
      </Field>
      <Field
        label="Fee amount (base units)"
        hint={currentFee !== null ? `Current fee for this script: ${currentFee}` : undefined}
      >
        <input
          type="text"
          value={feeAmount}
          onChange={(e) => setFeeAmount(e.target.value)}
          placeholder="0"
          className={textInputClass}
        />
      </Field>
    </AdminActionCard>
  );
}
