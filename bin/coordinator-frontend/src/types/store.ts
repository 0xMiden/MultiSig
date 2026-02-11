// Store/State management types
// WalletFormData is now defined in store/slices/walletSlice.ts

export interface WalletFormData {
  walletName: string;
  signatureThreshold: string;
  totalSigners: string;
  network: string;
  signerAddresses: string[];
  signerPublicKeys: string[];
}

export interface WalletState {
  formData: WalletFormData;
  currentStep: number;
  isLoading: boolean;
  error: string | null;
}

// RootState and AppDispatch are now exported from store/index.ts
export type { RootState, AppDispatch } from '@/store/index';
