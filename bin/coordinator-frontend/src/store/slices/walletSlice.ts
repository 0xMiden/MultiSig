import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface WalletFormData {
  walletName: string;
  signatureThreshold: string;
  totalSigners: string;
  network: string;
  signerAddresses: string[];
  signerPublicKeys: string[];
}

interface WalletState {
  formData: WalletFormData;
  currentStep: number;
  isLoading: boolean;
  error: string | null;
}

const initialState: WalletState = {
  formData: {
    walletName: '',
    signatureThreshold: '',
    totalSigners: '',
    network: 'Miden Network',
    signerAddresses: [''],
    signerPublicKeys: [''],
  },
  currentStep: 1,
  isLoading: false,
  error: null,
};

const walletSlice = createSlice({
  name: 'wallet',
  initialState,
  reducers: {
    updateFormData: (state, action: PayloadAction<Partial<WalletFormData>>) => {
      state.formData = { ...state.formData, ...action.payload };
    },
    updateFormField: (state, action: PayloadAction<{ field: keyof WalletFormData; value: string }>) => {
      const { field, value } = action.payload;
      if (field === 'signerAddresses' || field === 'signerPublicKeys') {
        return;
      }
      if (field === 'totalSigners' && value !== state.formData.totalSigners) {
        // Keep only signer 0 (local/auto-populated), clear the rest
        state.formData.signerAddresses = [state.formData.signerAddresses[0] ?? ''];
        state.formData.signerPublicKeys = [state.formData.signerPublicKeys[0] ?? ''];
      }
      (state.formData[field] as string) = value;
    },
    updateSignerAddress: (state, action: PayloadAction<{ index: number; value: string }>) => {
      const { index, value } = action.payload;
      state.formData.signerAddresses[index] = value;
    },
    updateSignerPublicKey: (state, action: PayloadAction<{ index: number; value: string }>) => {
      const { index, value } = action.payload;
      state.formData.signerPublicKeys[index] = value;
    },
    addSignerAddress: (state) => {
      state.formData.signerAddresses.push('');
      state.formData.signerPublicKeys.push('');
    },
    removeSignerAddress: (state, action: PayloadAction<number>) => {
      const index = action.payload;
      state.formData.signerAddresses = state.formData.signerAddresses.filter((_, i) => i !== index);
      state.formData.signerPublicKeys = state.formData.signerPublicKeys.filter((_, i) => i !== index);
    },
    setCurrentStep: (state, action: PayloadAction<number>) => {
      state.currentStep = action.payload;
    },
    resetForm: (state) => {
      state.formData = initialState.formData;
      state.currentStep = 1;
      state.error = null;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
  },
});

export const {
  updateFormData,
  updateFormField,
  updateSignerAddress,
  updateSignerPublicKey,
  addSignerAddress,
  removeSignerAddress,
  setCurrentStep,
  resetForm,
  setLoading,
  setError,
} = walletSlice.actions;

export type { WalletState };
export default walletSlice.reducer;
