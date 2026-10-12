import { UserFacingError } from './errors';

/**
 * The one Miden network this deployment talks to (NEXT_PUBLIC_MIDEN_NETWORK).
 * The Miden Wallet's network, the Bech32 address prefix and the invitation and
 * funding rules follow it. The RPC, note transport and prover URLs are set
 * separately and nothing cross-checks them: they must point at this network.
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

/**
 * Whether the node funds a newly registered account. Testnet sends 1 USDCX;
 * devnet stopped (2026-10-08) and mainnet, local and custom nodes never did,
 * so there is no funding note to wait for there.
 */
export function fundsOnRegistration(network: MidenNetwork): boolean {
  return network === 'testnet';
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

/**
 * Checks a creator's invitation code with the node before anything is
 * created, so a mistyped code can be corrected instead of stranding a new
 * account that cannot register. The node's own error is passed on.
 *
 * Nodes that predate the check (testnet and devnet 0.17.1 answer
 * UNIMPLEMENTED) cannot tell: creation then goes ahead as before, and a bad
 * code shows up at registration.
 */
export async function assertInvitationCodeValid(
  accounts: { isInvitationCodeValid(code: string): Promise<boolean> },
  code: string,
): Promise<void> {
  let valid: boolean;
  try {
    valid = await accounts.isInvitationCodeValid(code);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (NODE_LACKS_METHOD.test(message)) return;
    throw new UserFacingError(`The node could not check the invitation code: ${message}`);
  }
  if (!valid) {
    throw new UserFacingError('The node rejected this invitation code. Check it and try again; nothing was created.');
  }
}

/** The SDK's error for a gRPC UNIMPLEMENTED answer. */
const NODE_LACKS_METHOD = /not implemented by this version of the Miden node/i;
