import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchApproverListThunk, fetchMultisigAccountDetailsThunk } from '../services/transactionApi';
import { WalletFormData, WalletData } from '../types';
import { AppDispatch, RootState } from '../store';

export const useWalletData = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { approvers, walletData: walletDataFromStore } = useSelector((state: RootState) => state.wallet);
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const walletId = localStorage.getItem('currentWalletId');
    
    if (!walletId) {
      setError('No wallet ID found');
      setLoading(false);
      return;
    }

    // Fetch approvers and wallet details
    dispatch(fetchApproverListThunk({ accountId: walletId }));
    dispatch(fetchMultisigAccountDetailsThunk({ accountId: walletId }));
    
    setLoading(false);
  }, [dispatch]);

  // Update walletData when approvers or walletDataFromStore changes
  useEffect(() => {
    const updateWalletData = () => {
      const walletFormDataString = localStorage.getItem('walletFormData');
      let walletFormData: WalletFormData | undefined;
      
      if (walletFormDataString) {
        try {
          walletFormData = JSON.parse(walletFormDataString);
        } catch (parseError) {
          console.warn('Failed to parse walletFormData from localStorage:', parseError);
        }
      }
      
      const updatedWalletData: WalletData = {
        approver_number: approvers.length,
        kind: walletDataFromStore?.kind || '',
        threshold: walletDataFromStore?.threshold || 0,
        approver: approvers.map(approver => approver.address),
        walletFormData
      };
      setWalletData(updatedWalletData);
    };

    updateWalletData();
  }, [approvers, walletDataFromStore]);

  return { walletData, loading, error };
};
