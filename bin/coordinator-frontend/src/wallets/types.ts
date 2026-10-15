import type { SignatureScheme } from '@openzeppelin/miden-multisig-client';

export type WalletSource = 'local' | 'para' | 'miden-wallet' | 'ledger';

export interface ExternalWalletState {
  source: WalletSource;
  connected: boolean;
  publicKey: string | null;
  commitment: string | null;
  scheme: SignatureScheme | null;
  /** The wallet's connected bech32 address, when the wallet exposes one (Bread does). */
  address?: string | null;
}
