import type { Account } from '@miden-sdk/miden-sdk';

/** The slice of `MidenClient` this module needs, kept structural so tests can fake it. */
export interface FaucetAccountClient {
  accounts: {
    get(accountId: string): Promise<Account | null>;
    import(accountId: string): Promise<Account>;
  };
  sync(): Promise<unknown>;
}

/**
 * Fetches the faucet `Account`, importing it into the client's local store the first time and
 * reading the store (after a best-effort sync) from then on. Shared by the admin target evaluation
 * (`useAdminTargets`), which needs the faucet's current role membership for role gating, the roles
 * page and the last-ADMIN guardrail.
 *
 * Why the import path and not `RpcClient.getAccountDetails`: the node caps how many entries of one
 * storage map a `GetAccount` response carries (1000) and flags a bigger map instead of returning
 * it. The SDK's `getAccountDetails` builds the `Account` straight from that response and refuses a
 * flagged map ("storage map slot '…' has too many entries"), which the USDCx faucet hits once its
 * `used_nonces` map passes the cap (one entry per attested mint). The client's import path fills
 * flagged maps in through `SyncAccountStorageMaps` before building the account, and `sync()` keeps
 * the tracked copy current with incremental map deltas afterwards.
 */
export async function fetchFaucetAccount(midenClient: FaucetAccountClient, faucetId: string): Promise<Account> {
  const tracked = await midenClient.accounts.get(faucetId);
  if (!tracked) {
    return midenClient.accounts.import(faucetId);
  }
  // A failed sync must not hide the faucet: the local copy is at worst a few blocks behind, and
  // the periodic re-read retries.
  await midenClient.sync().catch(() => undefined);
  return (await midenClient.accounts.get(faucetId)) ?? tracked;
}

/** The faucet's serialized bytes, as consumed by `evaluateRoles`/`runGuardrails`. */
export async function fetchFaucetBytes(midenClient: FaucetAccountClient, faucetId: string): Promise<Uint8Array> {
  const account = await fetchFaucetAccount(midenClient, faucetId);
  return account.serialize();
}
