// Wallet-related types
export interface WalletFormData {
  walletName: string;
  signatureThreshold: string;
  totalSigners: string;
  network: string;
  signerAddresses: string[];
  signerPublicKeys: string[];
}

export interface CreateWalletRequest {
  threshold: number;
  approvers: string[];
  pub_key_commits: string[];
}

export interface CreateWalletResponse {
  address: string;
  created_at: string;
  updated_at: string;
}

export interface GetAccountInfoResponse {
  multisig_account: {
    address: string;
    kind: string;
    threshold: number;
    created_at: string;
    updated_at: string;
  };
} 