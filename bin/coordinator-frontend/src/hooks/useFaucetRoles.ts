'use client';

import { useEffect, useState } from 'react';
import { AccountId, Endpoint, RpcClient, type Account } from '@miden-sdk/miden-sdk';
import { useMultisig } from '@/contexts/MultisigContext';
import { getAdminConfig } from '@/config/adminConfig';
import { initAdminWasm } from '@/lib/admin/noteBuilders';
import { evaluateRoles, type Role } from '@/lib/admin/roles';
import { MIDEN_RPC_URL } from '@/config/psm';

export type RolesState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; roles: Record<Role, boolean> };

const LOADING: RolesState = { status: 'loading' };

/**
 * Fetches the faucet `Account` (local store first, falling back to a direct-node fetch exactly
 * like `fetchTokenInfo` in `@/lib/tokenAmounts`) and evaluates which RBAC roles the acting
 * multisig (`multisig.account`, not the signer commitment) holds on it.
 *
 * `status: 'error'` covers every fetch/parse/evaluation failure -- this never falls back to a
 * silent all-false `ready`, since that would be indistinguishable from "really holds no roles".
 */
export function useFaucetRoles(): RolesState {
  const { midenClient, multisig } = useMultisig();
  const [state, setState] = useState<RolesState>(LOADING);

  useEffect(() => {
    if (!multisig || !midenClient) {
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

        const accountHex = multisig.account.id().toString();

        let faucetAccount: Account | null = await midenClient.accounts.get(faucetId);
        if (!faucetAccount) {
          const rpc = new RpcClient(new Endpoint(MIDEN_RPC_URL));
          try {
            const fetched = await rpc.getAccountDetails(AccountId.fromHex(faucetId));
            faucetAccount = fetched.account();
          } finally {
            rpc.free();
          }
        }
        if (!faucetAccount) {
          throw new Error(`Could not read the faucet account ${faucetId}: account state is private`);
        }

        const faucetBytes = faucetAccount.serialize();
        const roles = evaluateRoles(faucetBytes, accountHex);
        if (!cancelled) setState({ status: 'ready', roles });
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
  }, [midenClient, multisig]);

  return state;
}
