'use client';

import { AdminActionCard } from './AdminActionCard';
import type { AdminRecipe } from '@/lib/admin/recipe';
import type { FaucetBytesState } from '@/hooks/useFaucetAccountBytes';
import { ACTION_INFO } from '@/lib/admin/roles';

interface GroupProps {
  faucetBytesState: FaucetBytesState;
  inflightRecipes: AdminRecipe[];
}

/** DOM_PAUSER-gated: pause the faucet domain. Confirm-only -- no fields. */
export function PauseForm({ faucetBytesState, inflightRecipes }: GroupProps) {
  return (
    <AdminActionCard
      action="pause"
      title={ACTION_INFO.pause.title}
      description={ACTION_INFO.pause.description}
      faucetBytesState={faucetBytesState}
      inflightRecipes={inflightRecipes}
      buildArgs={() => ({ action: 'pause' })}
      submitLabel="Pause"
    >
      <div className="text-[12px] text-[rgba(0,0,0,0.5)]">
        No inputs required -- review and confirm to propose pausing USDCx.
      </div>
    </AdminActionCard>
  );
}

/** DOM_UNPAUSER-gated: unpause the faucet domain. Confirm-only -- no fields. */
export function UnpauseForm({ faucetBytesState, inflightRecipes }: GroupProps) {
  return (
    <AdminActionCard
      action="unpause"
      title={ACTION_INFO.unpause.title}
      description={ACTION_INFO.unpause.description}
      faucetBytesState={faucetBytesState}
      inflightRecipes={inflightRecipes}
      buildArgs={() => ({ action: 'unpause' })}
      submitLabel="Unpause"
    >
      <div className="text-[12px] text-[rgba(0,0,0,0.5)]">
        No inputs required -- review and confirm to propose unpausing USDCx.
      </div>
    </AdminActionCard>
  );
}
