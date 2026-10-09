'use client';

import { useState } from 'react';
import { AdminActionCard } from './AdminActionCard';
import { AccountIdField, ToggleField } from './fields';
import { normalizeAccountId } from '@/lib/admin/validation';
import { getAdminConfig } from '@/config/adminConfig';
import type { AdminRecipe } from '@/lib/admin/recipe';
import type { ActionSender } from '@/lib/admin/directAction';
import type { FaucetBytesState } from '@/hooks/useAdminTargets';
import { ACTION_INFO } from '@/lib/admin/roles';

interface GroupProps {
  faucetBytesState: FaucetBytesState;
  inflightRecipes: AdminRecipe[];
  /** Who sends the action: the acting multisig (a proposal) or the connected Bread account. */
  sender?: ActionSender;
}

/** BLK_MANAGER-gated: add or remove an account from the faucet's blocklist. */
export function BlocklistForm({ faucetBytesState, inflightRecipes, sender }: GroupProps) {
  const [accountId, setAccountId] = useState('');
  const [blocked, setBlocked] = useState(true);
  const cfg = getAdminConfig();

  return (
    <AdminActionCard
      action="blocklist"
      title={blocked ? 'Block account' : 'Unblock account'}
      description={ACTION_INFO.blocklist.description}
      faucetBytesState={faucetBytesState}
      inflightRecipes={inflightRecipes}
      sender={sender}
      buildArgs={() => ({ action: 'blocklist', accountId: normalizeAccountId(accountId, cfg.networkId), blocked })}
      onSubmitted={() => {
        setAccountId('');
        setBlocked(true);
      }}
    >
      <AccountIdField label="Target account ID" value={accountId} onChange={setAccountId} networkId={cfg.networkId} />
      <ToggleField label="Block this account" value={blocked} onChange={setBlocked} />
    </AdminActionCard>
  );
}
