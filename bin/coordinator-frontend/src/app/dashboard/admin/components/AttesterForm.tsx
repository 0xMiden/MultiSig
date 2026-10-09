'use client';

import { useState } from 'react';
import { AdminActionCard } from './AdminActionCard';
import { Field, ToggleField, textInputClass } from './fields';
import { parseWordHex } from '@/lib/admin/validation';
import type { AdminRecipe } from '@/lib/admin/recipe';
import type { ActionSender } from '@/lib/admin/directAction';
import type { FaucetBytesState } from '@/hooks/useAdminTargets';
import { ACTION_INFO } from '@/lib/admin/roles';
import { useFaucetConfig } from '@/hooks/useFaucetConfig';

interface GroupProps {
  faucetBytesState: FaucetBytesState;
  inflightRecipes: AdminRecipe[];
  /** Who sends the action: the acting multisig (a proposal) or the connected Bread account. */
  sender?: ActionSender;
}

/** ATTEST_ADMIN-gated: enable or disable an attester commitment. */
export function SetAttesterForm({ faucetBytesState, inflightRecipes, sender }: GroupProps) {
  const [commitment, setCommitment] = useState('');
  const [enabled, setEnabled] = useState(true);
  const current = useFaucetConfig(faucetBytesState);

  return (
    <AdminActionCard
      action="set_attester"
      title={ACTION_INFO.set_attester.title}
      description={ACTION_INFO.set_attester.description}
      faucetBytesState={faucetBytesState}
      inflightRecipes={inflightRecipes}
      sender={sender}
      buildArgs={() => ({ action: 'set_attester', commitment: parseWordHex(commitment), enabled })}
      onSubmitted={() => {
        setCommitment('');
        setEnabled(true);
      }}
    >
      <Field label="Attester commitment (64 hex chars)">
        <input
          type="text"
          value={commitment}
          onChange={(e) => setCommitment(e.target.value)}
          placeholder="0x…"
          className={textInputClass}
        />
      </Field>
      <ToggleField label="Enabled" value={enabled} onChange={setEnabled} />
      {current && (
        <div className="text-[12px] text-[rgba(0,0,0,0.5)]">
          <div className="font-[500]">
            Currently enabled: {current.attesters.length === 0 ? 'none' : `${current.attesters.length} attester${current.attesters.length === 1 ? '' : 's'}`}
          </div>
          {current.attesters.length > 0 && (
            <ul className="mt-1 flex flex-col gap-0.5">
              {current.attesters.map((c) => (
                <li key={c} className="font-mono break-all">
                  {c}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </AdminActionCard>
  );
}
