'use client';

import { AdminActionCard } from './AdminActionCard';
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

/** DOM_PAUSER-gated: pause the faucet domain. Confirm-only -- no fields. */
export function PauseForm({ faucetBytesState, inflightRecipes, sender }: GroupProps) {
  const { active } = useAdminTarget();
  const target = active!.target;
  return (
    <AdminActionCard
      action="pause"
      title={actionInfo(target, 'pause').title}
      description={actionInfo(target, 'pause').description}
      faucetBytesState={faucetBytesState}
      inflightRecipes={inflightRecipes}
      sender={sender}
      buildArgs={() => ({ action: 'pause' })}
      submitLabel="Pause"
    >
      <div className="text-[12px] text-[rgba(0,0,0,0.5)]">
        No inputs required -- review and confirm to {sender === 'bread' ? 'send' : 'propose'} pausing the {target.labels.contractNoun}.
      </div>
    </AdminActionCard>
  );
}

/** DOM_UNPAUSER-gated: unpause the faucet domain. Confirm-only -- no fields. */
export function UnpauseForm({ faucetBytesState, inflightRecipes, sender }: GroupProps) {
  const { active } = useAdminTarget();
  const target = active!.target;
  return (
    <AdminActionCard
      action="unpause"
      title={actionInfo(target, 'unpause').title}
      description={actionInfo(target, 'unpause').description}
      faucetBytesState={faucetBytesState}
      inflightRecipes={inflightRecipes}
      sender={sender}
      buildArgs={() => ({ action: 'unpause' })}
      submitLabel="Unpause"
    >
      <div className="text-[12px] text-[rgba(0,0,0,0.5)]">
        No inputs required -- review and confirm to {sender === 'bread' ? 'send' : 'propose'} unpausing the {target.labels.contractNoun}.
      </div>
    </AdminActionCard>
  );
}
