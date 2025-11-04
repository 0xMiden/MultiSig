import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { WalletFormData, Approver, MultisigAccount } from '../../types';

interface WalletState {
  formData: WalletFormData;
  currentStep: number;
  isLoading: boolean;
  error: string | null;
  approvers: Approver[];
  approversLoading: boolean;
  approversError: string | null;
  walletData: MultisigAccount | null;
  walletDataLoading: boolean;
  walletDataError: string | null;
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
  approvers: [],
  approversLoading: false,
  approversError: null,
  walletData: null,
  walletDataLoading: false,
  walletDataError: null,
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
      if (field === 'signerAddresses') {
        // Handle signer addresses array separately
        return;
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
    setApprovers: (state, action: PayloadAction<Approver[]>) => {
      state.approvers = action.payload;
      state.approversError = null;
    },
    setApproversLoading: (state, action: PayloadAction<boolean>) => {
      state.approversLoading = action.payload;
    },
    setApproversError: (state, action: PayloadAction<string | null>) => {
      state.approversError = action.payload;
      state.approversLoading = false;
    },
    clearApprovers: (state) => {
      state.approvers = [];
      state.approversError = null;
      state.approversLoading = false;
    },
    setWalletData: (state, action: PayloadAction<MultisigAccount>) => {
      state.walletData = action.payload;
      state.walletDataError = null;
    },
    setWalletDataLoading: (state, action: PayloadAction<boolean>) => {
      state.walletDataLoading = action.payload;
    },
    setWalletDataError: (state, action: PayloadAction<string | null>) => {
      state.walletDataError = action.payload;
      state.walletDataLoading = false;
    },
    clearWalletData: (state) => {
      state.walletData = null;
      state.walletDataError = null;
      state.walletDataLoading = false;
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
  setApprovers,
  setApproversLoading,
  setApproversError,
  clearApprovers,
  setWalletData,
  setWalletDataLoading,
  setWalletDataError,
  clearWalletData,
} = walletSlice.actions;

export type { WalletState, WalletFormData };
export default walletSlice.reducer; 