import type { WalletAdapterNetwork } from '@miden-sdk/miden-wallet-adapter-base';
import type { MidenNetwork } from './midenNetwork';

/**
 * The network names the Miden Wallet connects on: the adapter's
 * WalletAdapterNetwork values, plus mainnet. The adapter has no mainnet entry
 * yet (0.17.6), but it hands the name to the wallet unchanged, and the wallet
 * takes "mainnet" when it runs on mainnet.
 */
const WALLET_NETWORK: Partial<Record<MidenNetwork, string>> = {
  devnet: 'devnet',
  testnet: 'testnet',
  local: 'localnet',
  mainnet: 'mainnet',
};

/** The network the Miden Wallet is asked to connect on. */
export function walletNetworkFor(network: MidenNetwork): WalletAdapterNetwork {
  const name = WALLET_NETWORK[network];
  if (!name) {
    throw new Error(`The Miden Wallet has no ${network} network; set NEXT_PUBLIC_MIDEN_NETWORK to devnet, testnet, mainnet or local.`);
  }
  return name as WalletAdapterNetwork;
}

/** The wallet's refusal when it runs on another network than the one asked for. */
const NETWORK_NOT_GRANTED = 'NETWORK_NOT_GRANTED';

/** A Miden Wallet connection error as the user should read it. */
export function walletConnectErrorMessage(err: Error, network: MidenNetwork): string {
  const message = err.message || err.name || 'Unknown wallet error';
  if (message.includes(NETWORK_NOT_GRANTED)) {
    return `Your Miden Wallet is not on ${network}. Switch it to ${network} and connect again.`;
  }
  return message;
}
