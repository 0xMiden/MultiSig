import { AccountId, Endpoint, RpcClient, type Account, type MidenClient } from '@miden-sdk/miden-sdk';
import { MIDEN_RPC_URL } from '@/config/psm';

/**
 * Fetches the faucet `Account`, trying the client's local store first and falling back to a
 * direct-node fetch (mirrors `fetchTokenInfo` in `@/lib/tokenAmounts`). Shared by `useFaucetRoles`
 * (role evaluation) and the admin mask's guardrail check (`runGuardrails`), which both need the
 * faucet's serialized bytes -- kept here once so the fetch-with-fallback logic isn't duplicated.
 */
export async function fetchFaucetAccount(midenClient: MidenClient, faucetId: string): Promise<Account> {
  let faucetAccount: Account | null = await midenClient.accounts.get(faucetId);
  if (!faucetAccount) {
    const rpc = new RpcClient(new Endpoint(MIDEN_RPC_URL));
    try {
      const fetched = await rpc.getAccountDetails(AccountId.fromHex(faucetId));
      faucetAccount = fetched.account() ?? null;
    } finally {
      rpc.free();
    }
  }
  if (!faucetAccount) {
    throw new Error(`Could not read the faucet account ${faucetId}: account state is private`);
  }
  return faucetAccount;
}

/** The faucet's serialized bytes, as consumed by `evaluateRoles`/`runGuardrails`. */
export async function fetchFaucetBytes(midenClient: MidenClient, faucetId: string): Promise<Uint8Array> {
  const account = await fetchFaucetAccount(midenClient, faucetId);
  return account.serialize();
}
