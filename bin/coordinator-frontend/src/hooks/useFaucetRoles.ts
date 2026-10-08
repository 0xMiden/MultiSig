'use client';

import { useEffect, useState } from 'react';
import { useMultisig } from '@/contexts/MultisigContext';
import { getAdminConfig } from '@/config/adminConfig';
import { initAdminWasm } from '@/lib/admin/noteBuilders';
import { accountIdHexFromBech32 } from '@/lib/admin/directAction';
import { evaluateRoles, type Role } from '@/lib/admin/roles';
import { fetchFaucetBytes } from '@/lib/admin/faucetAccount';

export type RolesState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready';
      /** Roles of the acting multisig; `null` when no multisig is loaded. */
      roles: Record<Role, boolean> | null;
      /** Roles of the account connected through Bread; `null` when Bread is not connected. */
      breadRoles: Record<Role, boolean> | null;
      /** The Bread account's id (hex) the `breadRoles` were evaluated for. */
      breadAccountId: string | null;
    };

const LOADING: RolesState = { status: 'loading' };

/**
 * Fetches the faucet `Account` (local store first, falling back to a direct-node fetch exactly
 * like `fetchTokenInfo` in `@/lib/tokenAmounts`) and evaluates which RBAC roles two parties hold
 * on it: the acting multisig (`multisig.account`, not the signer commitment) and, when Bread is
 * the connected wallet, the account Bread is connected as (which may hold a role of its own, e.g.
 * a single-sig DOM_PAUSER, and then sends that action directly -- see `lib/admin/directAction`).
 *
 * Stays `loading` while there is nobody to evaluate (no multisig and no Bread account).
 * `status: 'error'` covers every fetch/parse/evaluation failure -- this never falls back to a
 * silent all-false `ready`, since that would be indistinguishable from "really holds no roles".
 */
export function useFaucetRoles(): RolesState {
  const { midenClient, multisig, walletSource, midenWalletSession } = useMultisig();
  const [state, setState] = useState<RolesState>(LOADING);

  const breadAddress =
    walletSource === 'miden-wallet' && midenWalletSession.connected ? (midenWalletSession.address ?? null) : null;

  useEffect(() => {
    if (!midenClient || (!multisig && !breadAddress)) {
      setState(LOADING);
      return;
    }

    let cancelled = false;
    setState(LOADING);

    (async () => {
      try {
        const { faucetId } = getAdminConfig();
        if (!faucetId) throw new Error('NEXT_PUBLIC_USDCX_FAUCET_ID is not set');

        await initAdminWasm();

        const faucetBytes = await fetchFaucetBytes(midenClient, faucetId);

        const roles = multisig ? evaluateRoles(faucetBytes, multisig.account.id().toString()) : null;
        const breadAccountId = breadAddress ? accountIdHexFromBech32(breadAddress) : null;
        const breadRoles = breadAccountId ? evaluateRoles(faucetBytes, breadAccountId) : null;

        if (!cancelled) setState({ status: 'ready', roles, breadRoles, breadAccountId });
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : String(err);
          setState({ status: 'error', message: `Could not determine faucet roles: ${message}` });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [midenClient, multisig, breadAddress]);

  return state;
}
