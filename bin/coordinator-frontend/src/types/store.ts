// Store/State management types
import { Transaction } from './transaction';

// Transaction State
export interface TransactionState {
  pendingTransactions: Transaction[];
  allTransactions: Transaction[];
  currentTransactionId: string | null;
  loading: boolean;
  error: string | null;
}

// Wallet Form Data Type
export interface WalletFormData {
  walletName: string;
  signatureThreshold: string;
  totalSigners: string;
  network: string;
  signerAddresses: string[];
  signerPublicKeys: string[];
}

// Wallet State
export interface WalletState {
  formData: WalletFormData | null;
  currentStep: number;
  isLoading: boolean;
  error: string | null;
  approvers: Array<{
    address: string;
    pub_key_commit: string;
    created_at: string;
    updated_at: string;
  }>;
  approversLoading: boolean;
  approversError: string | null;
  walletData: {
    address: string;
    kind: string;
    threshold: number;
    created_at: string;
    updated_at: string;
  } | null;
  walletDataLoading: boolean;
  walletDataError: string | null;
}

// Signature Data Type
export interface SignatureData {
  tx_id: string;
  approver: string;
  signature: string;
  created_at?: string;
}

// Signature State
export interface SignatureState {
  signatures: SignatureData[];
  loading: boolean;
  error: string | null;
}

// Wallet Stats State
export interface WalletStatsState {
  stats: {
    total: number;
    last_month: number;
    total_success: number;
  } | null;
  loading: boolean;
  error: string | null;
}

// Root State and Dispatch Types
export type RootState = {
  wallet: WalletState;
  transaction: TransactionState;
  signature: SignatureState;
  walletStats: WalletStatsState;
};

// AppDispatch will be typed from the store
// Using a simpler type here to avoid circular dependencies
export type AppDispatch = (action: unknown) => void;
