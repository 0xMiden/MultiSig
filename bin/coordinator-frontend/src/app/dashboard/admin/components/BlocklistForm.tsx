'use client';

import { useState } from 'react';
import { AdminActionCard } from './AdminActionCard';
import { Field, ToggleField, textInputClass } from './fields';
import { normalizeAccountId } from '@/lib/admin/validation';
import { getAdminConfig } from '@/config/adminConfig';
import type { AdminRecipe } from '@/lib/admin/recipe';
import type { FaucetBytesState } from '@/hooks/useFaucetAccountBytes';

interface GroupProps {
  faucetBytesState: FaucetBytesState;
  inflightRecipes: AdminRecipe[];
}

/** BLK_MANAGER-gated: add or remove an account from the faucet's blocklist. */
export function BlocklistForm({ faucetBytesState, inflightRecipes }: GroupProps) {
  const [accountId, setAccountId] = useState('');
  const [blocked, setBlocked] = useState(true);
  const cfg = getAdminConfig();

  return (
    <AdminActionCard
      action="blocklist"
      title={blocked ? 'Block account' : 'Unblock account'}
      description="Adds or removes an account from this faucet's blocklist."
      faucetBytesState={faucetBytesState}
      inflightRecipes={inflightRecipes}
      buildArgs={() => ({ action: 'blocklist', accountId: normalizeAccountId(accountId, cfg.networkId), blocked })}
      onSubmitted={() => {
        setAccountId('');
        setBlocked(true);
      }}
    >
      <Field label="Target account ID">
        <input
          type="text"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          placeholder="0x…"
          className={textInputClass}
        />
      </Field>
      <ToggleField label="Block this account" value={blocked} onChange={setBlocked} />
    </AdminActionCard>
  );
}
