/**
 * The one Miden network this deployment talks to. Every network-specific
 * choice (RPC, the Miden Wallet's network, the Bech32 address prefix) derives
 * from it, so they cannot disagree.
 */
export type MidenNetwork = 'devnet' | 'testnet' | 'mainnet' | 'local' | 'custom';

const NETWORKS: readonly MidenNetwork[] = ['devnet', 'testnet', 'mainnet', 'local', 'custom'];

/** NEXT_PUBLIC_MIDEN_NETWORK: required, one of the names above. */
export function parseMidenNetwork(value: string | undefined): MidenNetwork {
  const named = value?.trim().toLowerCase();
  if (named && (NETWORKS as readonly string[]).includes(named)) return named as MidenNetwork;
  throw new Error(
    named
      ? `NEXT_PUBLIC_MIDEN_NETWORK must be one of ${NETWORKS.join(', ')}; got "${value}".`
      : `NEXT_PUBLIC_MIDEN_NETWORK is not set (one of ${NETWORKS.join(', ')}).`,
  );
}

/** Bech32 human-readable prefix per network, as in miden-protocol / miden-client. */
export const BECH32_PREFIX: Record<MidenNetwork, string> = {
  mainnet: 'mm',
  testnet: 'mtst',
  devnet: 'mdev',
  local: 'mlcl',
  custom: 'mcst',
};

/**
 * Node-registration invitation code: the create page shows it pre-filled with
 * this default, and the creator can change it. Testnet accepts any code except
 * devnet's ("guardian" is refused by its funding service), so it gets a neutral
 * one; devnet uses the deployment's code; mainnet has none and requires the
 * creator's.
 */
export const TESTNET_INVITATION_CODE = '00000';

export function defaultInvitationCode(network: MidenNetwork, configured: string): string {
  if (network === 'testnet') return TESTNET_INVITATION_CODE;
  if (network === 'mainnet') return '';
  return configured;
}

export function invitationCodeRequired(network: MidenNetwork): boolean {
  return network === 'mainnet';
}

/** The code to send: the creator's if given, else the network default; an error if one is required and missing. */
export function registrationInvitationCode(network: MidenNetwork, configured: string, provided?: string): string {
  const code = provided?.trim() || defaultInvitationCode(network, configured);
  if (!code && invitationCodeRequired(network)) {
    throw new Error('An invitation code is required to register an account on this network.');
  }
  return code;
}
