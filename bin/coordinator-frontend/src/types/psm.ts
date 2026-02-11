import type { AuthSecretKey } from '@miden-sdk/miden-sdk';
import type { SignatureScheme } from '@openzeppelin/miden-multisig-client';

export type { WalletSource, ExternalWalletState } from '@/wallets/types';

export interface SignerKeyInfo {
  commitment: string;
  secretKey: AuthSecretKey;
}

export interface SignerInfo {
  falcon: SignerKeyInfo;
  ecdsa: SignerKeyInfo;
  activeScheme: SignatureScheme;
}

export interface OtherSigner {
  id: string;
  commitment: string;
}
