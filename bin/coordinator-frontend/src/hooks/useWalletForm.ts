import { useAppDispatch, useAppSelector } from '../store/hooks';
import { RootState } from '../store';
import {
  updateFormField,
  updateSignerAddress,
  updateSignerPublicKey,
  addSignerAddress,
  removeSignerAddress,
  setCurrentStep,
  resetForm,
  WalletFormData,
} from '../store/slices/walletSlice';

export const useWalletForm = () => {
  const dispatch = useAppDispatch();
  const walletState = useAppSelector((state: RootState) => state.wallet);
  const { formData, currentStep, isLoading, error } = walletState;

  const updateField = (field: string, value: string) => {
    dispatch(updateFormField({ field: field as keyof WalletFormData, value }));
  };

  const updateSigner = (index: number, value: string) => {
    dispatch(updateSignerAddress({ index, value }));
  };

  const updateSignerPublicKeyField = (index: number, value: string) => {
    dispatch(updateSignerPublicKey({ index, value }));
  };

  const addSigner = () => {
    dispatch(addSignerAddress());
  };

  const removeSigner = (index: number) => {
    dispatch(removeSignerAddress(index));
  };

  const goToStep = (step: number) => {
    dispatch(setCurrentStep(step));
  };

  const reset = () => {
    dispatch(resetForm());
  };

  return {
    formData,
    currentStep,
    isLoading,
    error,
    updateField,
    updateSigner,
    updateSignerPublicKeyField,
    addSigner,
    removeSigner,
    goToStep,
    reset,
  };
}; 