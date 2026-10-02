'use client';

import { useState } from 'react';
import { AdminActionCard } from './AdminActionCard';
import { Field, textInputClass, readOnlyInputClass } from './fields';
import { parseU64, parseMinBurn, parseNoteScriptRoot } from '@/lib/admin/validation';
import { getAdminConfig } from '@/config/adminConfig';
import { shortFaucetId } from '@/lib/tokenAmounts';
import type { AdminRecipe } from '@/lib/admin/recipe';
import type { FaucetBytesState } from '@/hooks/useFaucetAccountBytes';
import { ACTION_INFO } from '@/lib/admin/roles';

interface GroupProps {
  faucetBytesState: FaucetBytesState;
  inflightRecipes: AdminRecipe[];
}

/** ADMIN-gated: set the faucet's max issuable supply, in base units. */
export function SetMaxSupplyForm({ faucetBytesState, inflightRecipes }: GroupProps) {
  const [maxSupply, setMaxSupply] = useState('');

  return (
    <AdminActionCard
      action="set_max_supply"
      title={ACTION_INFO.set_max_supply.title}
      description={ACTION_INFO.set_max_supply.description}
      faucetBytesState={faucetBytesState}
      inflightRecipes={inflightRecipes}
      buildArgs={() => ({ action: 'set_max_supply', maxSupply: parseU64(maxSupply).toString() })}
      onSubmitted={() => setMaxSupply('')}
    >
      <Field label="New max supply (base units)">
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
export function SetMinBurnForm({ faucetBytesState, inflightRecipes }: GroupProps) {
  const [minBurn, setMinBurn] = useState('');

  return (
    <AdminActionCard
      action="set_min_burn"
      title={ACTION_INFO.set_min_burn.title}
      description={ACTION_INFO.set_min_burn.description}
      faucetBytesState={faucetBytesState}
      inflightRecipes={inflightRecipes}
      buildArgs={() => ({ action: 'set_min_burn', minBurn: parseMinBurn(minBurn).toString() })}
      onSubmitted={() => setMinBurn('')}
    >
      <Field label="New min burn (base units)">
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
export function SetNoteFeeForm({ faucetBytesState, inflightRecipes }: GroupProps) {
  const [noteScriptRoot, setNoteScriptRoot] = useState('');
  const [feeAmount, setFeeAmount] = useState('');
  const cfg = getAdminConfig();

  return (
    <AdminActionCard
      action="set_note_fee"
      title={ACTION_INFO.set_note_fee.title}
      description={ACTION_INFO.set_note_fee.description}
      faucetBytesState={faucetBytesState}
      inflightRecipes={inflightRecipes}
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
      <Field label="Fee amount (base units)">
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
