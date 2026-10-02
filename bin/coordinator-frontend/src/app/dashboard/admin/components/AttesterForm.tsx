'use client';

import { useState } from 'react';
import { AdminActionCard } from './AdminActionCard';
import { Field, ToggleField, textInputClass } from './fields';
import { parseWordHex } from '@/lib/admin/validation';
import type { AdminRecipe } from '@/lib/admin/recipe';
import type { FaucetBytesState } from '@/hooks/useFaucetAccountBytes';
import { ACTION_INFO } from '@/lib/admin/roles';

interface GroupProps {
  faucetBytesState: FaucetBytesState;
  inflightRecipes: AdminRecipe[];
}

/** ATTEST_ADMIN-gated: enable or disable an attester commitment. */
export function SetAttesterForm({ faucetBytesState, inflightRecipes }: GroupProps) {
  const [commitment, setCommitment] = useState('');
  const [enabled, setEnabled] = useState(true);

  return (
    <AdminActionCard
      action="set_attester"
      title={ACTION_INFO.set_attester.title}
      description={ACTION_INFO.set_attester.description}
      faucetBytesState={faucetBytesState}
      inflightRecipes={inflightRecipes}
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
    </AdminActionCard>
  );
}
