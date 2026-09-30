/**
 * The one Miden network this deployment talks to. Every network-specific
 * choice (RPC, the Miden Wallet's network, the Bech32 address prefix) derives
 * from it, so they cannot disagree.
 */
export type MidenNetwork = 'devnet' | 'testnet' | 'mainnet' | 'local' | 'custom';

const NETWORKS: readonly MidenNetwork[] = ['devnet', 'testnet', 'mainnet', 'local', 'custom'];

/**
 * NEXT_PUBLIC_MIDEN_NETWORK when set; otherwise inferred from the RPC setting
 * the way miden-client maps endpoints: the devnet/testnet shorthands or hosts,
 * localhost as `local`, anything else as `custom`.
 */
export function resolveMidenNetwork(explicit: string | undefined, rpc: string): MidenNetwork {
  const named = explicit?.trim().toLowerCase();
  if (named) {
    if ((NETWORKS as readonly string[]).includes(named)) return named as MidenNetwork;
    throw new Error(`NEXT_PUBLIC_MIDEN_NETWORK must be one of ${NETWORKS.join(', ')}; got "${explicit}".`);
  }
  const value = rpc.trim().toLowerCase();
  if (value === 'devnet' || value === 'testnet') return value;
  if (value === 'local' || value === 'localhost') return 'local';
  let host: string;
  try { host = new URL(value).hostname; } catch { return 'custom'; }
  if (host === 'rpc.devnet.miden.io') return 'devnet';
  if (host === 'rpc.testnet.miden.io') return 'testnet';
  if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]') return 'local';
  return 'custom';
}

/** Bech32 human-readable prefix per network, as in miden-protocol / miden-client. */
export const BECH32_PREFIX: Record<MidenNetwork, string> = {
  mainnet: 'mm',
  testnet: 'mtst',
  devnet: 'mdev',
  local: 'mlcl',
  custom: 'mcst',
};
