import { AccountId, Endpoint, RpcClient, type Account, type MidenClient } from '@miden-sdk/miden-sdk';
import { MIDEN_RPC_URL } from '@/config/psm';

/**
 * Fetches the faucet `Account` from the node, falling back to the client's local store only if
 * the node cannot be reached. The node comes first because role gating, the roles page and the
 * last-ADMIN guardrail all have to see the faucet's current role membership, and a copy in the
 * local store can lag behind it. Shared by `useFaucetRoles` and `useFaucetAccountBytes`.
 */
export async function fetchFaucetAccount(midenClient: MidenClient, faucetId: string): Promise<Account> {
  let faucetAccount: Account | null = null;
  let nodeError: unknown;
  const rpc = new RpcClient(new Endpoint(MIDEN_RPC_URL));
  try {
    const fetched = await rpc.getAccountDetails(AccountId.fromHex(faucetId));
    faucetAccount = fetched.account() ?? null;
  } catch (err) {
    nodeError = err;
  } finally {
    rpc.free();
  }
  if (!faucetAccount && nodeError !== undefined) {
    faucetAccount = await midenClient.accounts.get(faucetId);
    if (!faucetAccount) throw nodeError;
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
