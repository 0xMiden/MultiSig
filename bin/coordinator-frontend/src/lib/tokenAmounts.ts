import { AccountId, BasicFungibleFaucetComponent, Endpoint, RpcClient } from '@miden-sdk/miden-sdk';
import { MIDEN_RPC_URL } from '@/config/psm';

/**
 * Converts a user-entered decimal amount into base units for a token with
 * `decimals` decimal places. Exact string arithmetic: no floating point, and
 * more fractional digits than the token supports is an error rather than a
 * silent rounding.
 */
export function parseTokenAmount(input: string, decimals: number): bigint {
  const value = input.trim();
  const match = /^(\d*)(?:\.(\d*))?$/.exec(value);
  if (!value || !match || (match[1] === '' && !match[2])) {
    throw new Error('Enter a valid amount');
  }
  const [, whole, fraction = ''] = match;
  if (fraction.length > decimals) {
    throw new Error(
      decimals === 0
        ? 'This token does not support fractional amounts'
        : `This token supports at most ${decimals} decimal places`,
    );
  }
  const units = BigInt(`${whole || '0'}${fraction.padEnd(decimals, '0')}`);
  if (units <= 0n) throw new Error('Amount must be greater than zero');
  return units;
}

/** Formats base units as a decimal string, dropping trailing fractional zeros. */
export function formatTokenAmount(units: bigint | string, decimals: number): string {
  const value = BigInt(units);
  const scale = 10n ** BigInt(decimals);
  const whole = value / scale;
  const fraction = decimals === 0 ? '' : (value % scale).toString().padStart(decimals, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

const decimalsCache = new Map<string, Promise<number>>();

/**
 * Decimals of a fungible faucet, read from its on-chain metadata without
 * importing the faucet into the local store. Throws when the faucet is not a
 * readable public fungible faucet, so callers fail closed instead of guessing.
 */
export function getFaucetDecimals(faucetId: string): Promise<number> {
  const key = faucetId.trim().toLowerCase();
  let pending = decimalsCache.get(key);
  if (!pending) {
    pending = fetchFaucetDecimals(key);
    decimalsCache.set(key, pending);
    // Do not cache failures: a transient RPC error must not stick.
    pending.catch(() => decimalsCache.delete(key));
  }
  return pending;
}

async function fetchFaucetDecimals(faucetId: string): Promise<number> {
  const rpc = new RpcClient(new Endpoint(MIDEN_RPC_URL));
  try {
    const fetched = await rpc.getAccountDetails(AccountId.fromHex(faucetId));
    const account = fetched.account();
    if (!account) throw new Error('faucet state is private');
    const decimals = BasicFungibleFaucetComponent.fromAccount(account).decimals();
    if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
      throw new Error(`unexpected decimals ${decimals}`);
    }
    return decimals;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`Could not read token details for ${faucetId}: ${reason}`);
  } finally {
    rpc.free();
  }
}
