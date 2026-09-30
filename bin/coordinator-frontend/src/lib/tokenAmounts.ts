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

/** What the UI needs to show a token amount. */
export interface TokenInfo {
  decimals: number;
  symbol: string;
}

const tokenInfoCache = new Map<string, Promise<TokenInfo>>();

/** Upper bound on the metadata lookup; the SDK's RPC transport has no deadline of its own. */
export const DECIMALS_LOOKUP_TIMEOUT_MS = 15_000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error: unknown) => { clearTimeout(timer); reject(error); },
    );
  });
}

/**
 * Decimals and symbol of a fungible faucet, read from its on-chain metadata
 * without importing the faucet into the local store. Throws when the faucet is
 * not a readable public fungible faucet, so callers fail closed instead of
 * guessing. Cached per faucet; failures are not cached.
 */
export function getTokenInfo(
  faucetId: string,
  timeoutMs: number = DECIMALS_LOOKUP_TIMEOUT_MS,
): Promise<TokenInfo> {
  const key = faucetId.trim().toLowerCase();
  let pending = tokenInfoCache.get(key);
  if (!pending) {
    pending = withTimeout(
      fetchTokenInfo(key),
      timeoutMs,
      `Could not read token details for ${key}: the Miden node did not respond in time.`,
    );
    tokenInfoCache.set(key, pending);
    // Do not cache failures: a transient RPC error must not stick.
    pending.catch(() => tokenInfoCache.delete(key));
  }
  return pending;
}

export async function getFaucetDecimals(
  faucetId: string,
  timeoutMs: number = DECIMALS_LOOKUP_TIMEOUT_MS,
): Promise<number> {
  return (await getTokenInfo(faucetId, timeoutMs)).decimals;
}

async function fetchTokenInfo(faucetId: string): Promise<TokenInfo> {
  const rpc = new RpcClient(new Endpoint(MIDEN_RPC_URL));
  try {
    const fetched = await rpc.getAccountDetails(AccountId.fromHex(faucetId));
    const account = fetched.account();
    if (!account) throw new Error('faucet state is private');
    const faucet = BasicFungibleFaucetComponent.fromAccount(account);
    const decimals = faucet.decimals();
    if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
      throw new Error(`unexpected decimals ${decimals}`);
    }
    const symbol = faucet.symbol().toString().trim();
    return { decimals, symbol: symbol || shortFaucetId(faucetId) };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`Could not read token details for ${faucetId}: ${reason}`);
  } finally {
    rpc.free();
  }
}

/** Fallback label when a token has no readable symbol: never a well-known name. */
export function shortFaucetId(faucetId: string): string {
  const id = faucetId.trim();
  return id.length > 12 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;
}
