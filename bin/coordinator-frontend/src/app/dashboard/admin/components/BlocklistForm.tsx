'use client';

import { useState } from 'react';
import { AdminActionCard } from './AdminActionCard';
import { AccountIdField, ToggleField } from './fields';
import { normalizeAccountId } from '@/lib/admin/validation';
import type { AdminRecipe } from '@/lib/admin/recipe';
import type { ActionSender } from '@/lib/admin/directAction';
import type { FaucetBytesState } from '@/hooks/useAdminTargets';
import { actionInfo } from '@/lib/admin/roles';
import { useAdminTarget } from '@/contexts/AdminTargetContext';

interface GroupProps {
  faucetBytesState: FaucetBytesState;
  inflightRecipes: AdminRecipe[];
  /** Who sends the action: the acting multisig (a proposal) or the connected Bread account. */
  sender?: ActionSender;
}

/** BLK_MANAGER-gated: add or remove an account from the faucet's blocklist. */
export function BlocklistForm({ faucetBytesState, inflightRecipes, sender }: GroupProps) {
  const { active } = useAdminTarget();
  const target = active!.target;
  const [accountId, setAccountId] = useState('');
  const [blocked, setBlocked] = useState(true);

  return (
    <AdminActionCard
      action="blocklist"
      title={blocked ? 'Block account' : 'Unblock account'}
      description={actionInfo(target, 'blocklist').description}
      faucetBytesState={faucetBytesState}
      inflightRecipes={inflightRecipes}
      sender={sender}
      buildArgs={() => ({ action: 'blocklist', accountId: normalizeAccountId(accountId, target.networkId), blocked })}
      onSubmitted={() => {
        setAccountId('');
        setBlocked(true);
      }}
    >
      <AccountIdField label="Target account ID" value={accountId} onChange={setAccountId} networkId={target.networkId} />
      <ToggleField label="Block this account" value={blocked} onChange={setBlocked} />
    </AdminActionCard>
  );
}
