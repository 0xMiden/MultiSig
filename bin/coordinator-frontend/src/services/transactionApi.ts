// API service for transaction operations
import { createAsyncThunk } from '@reduxjs/toolkit';
import { setPendingTransactions, setAllTransactions, setLoading, setError } from '../store/slices/transactionSlice';
import { setWalletStats as setWalletStatsAction, setLoading as setWalletStatsLoading, setError as setWalletStatsError } from '../store/slices/walletStatsSlice';
import { setApprovers, setApproversLoading, setApproversError, setWalletData, setWalletDataLoading, setWalletDataError } from '../store/slices/walletSlice';
import {
  GetAccountTransactionsResponse,
  CreateTransactionRequest,
  GetTransactionStatsResponse,
  GetApproverListResponse,
  GetMultisigAccountDetailsResponse,
  ConsumableNote
} from '../types';
import { COORDINATOR_API_BASE_URL } from '../config/api';

// Get Account Transactions
export const getAccountTransactions = async (accountId: string, status?: string): Promise<GetAccountTransactionsResponse> => {
  try {
    const requestBody = {
      multisig_account_address: accountId,
      tx_status_filter: status
    };

    const response = await fetch(`${COORDINATOR_API_BASE_URL}/api/v1/multisig-tx/list`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      if (response.status === 404) {
        localStorage.removeItem('currentWalletId');
        document.cookie = 'currentWalletId=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting account transactions:', error);
    throw error;
  }
};

// Thunk for fetching pending transactions
export const fetchPendingTransactions = createAsyncThunk(
  'transaction/fetchPendingTransactions',
  async ({ accountId }: { accountId: string }, { dispatch }) => {
    try {
      dispatch(setLoading(true));
      dispatch(setError(null));

      const response = await getAccountTransactions(accountId, 'pending');
      dispatch(setPendingTransactions(response.txs));

      return response.txs;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch pending transactions';
      dispatch(setError(errorMessage));
      throw error;
    } finally {
      dispatch(setLoading(false));
    }
  }
);

// Thunk for fetching confirmed transactions
export const fetchConfirmedTransactions = createAsyncThunk(
  'transaction/fetchConfirmedTransactions',
  async ({ accountId }: { accountId: string }, { dispatch }) => {
    try {
      dispatch(setLoading(true));
      dispatch(setError(null));

      const response = await getAccountTransactions(accountId, "success");
      dispatch(setAllTransactions(response.txs));

      return response.txs;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch confirmed transactions';
      dispatch(setError(errorMessage));
      throw error;
    } finally {
      dispatch(setLoading(false));
    }
  }
);

// Thunk for proposing transaction with tx_bz payload
export const proposeTransactionWithTxBzThunk = createAsyncThunk(
  'transaction/proposeTransactionWithTxBz',
  async ({ accountId, txBz }: { accountId: string; txBz: string }, { dispatch }) => {
    try {
      const payload = {
        multisig_account_address: accountId,
        tx_request: txBz
      };

      console.log('Proposing transaction with payload:', payload);
      console.log('API URL:', `${COORDINATOR_API_BASE_URL}/api/v1/multisig-tx/propose`);
      console.log('Account ID:', accountId);
      console.log('TX BZ length:', txBz.length);

      const response = await fetch(`${COORDINATOR_API_BASE_URL}/api/v1/multisig-tx/propose`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      // Return the full response for now - we'll update this once we know the response structure
      return result;

    } catch (error) {
      console.error('Error proposing transaction with tx_bz:', error);
      throw error;
    }
  }
);

// Create Transaction
export const createTransaction = async (
  contractId: string,
  txEffect: string,
  txBz: string
): Promise<{ tx_id: string }> => {
  try {
    const payload = {
      contract_id: contractId,
      tx_effect: txEffect,
      tx_bz: txBz
    };
    const response = await fetch(`${COORDINATOR_API_BASE_URL}/api/v1/accounts/${contractId}/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      if (response.status === 404) {
        localStorage.removeItem('currentWalletId');
        document.cookie = 'currentWalletId=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    return result;
  } catch (error) {
    console.error('Error creating transaction:', error);
    throw error;
  }
};

// Thunk for creating transactions
export const createTransactionThunk = createAsyncThunk(
  'transaction/createTransaction',
  async ({ accountId, txEffect, txBz }: { accountId: string; txEffect: string; txBz: string }, { dispatch }) => {
    try {
      const result = await createTransaction(accountId, txEffect, txBz);

      // Refresh both pending and confirmed transaction lists after creation
      dispatch(fetchPendingTransactions({ accountId }));
      dispatch(fetchConfirmedTransactions({ accountId }));

      return result;
    } catch (error) {
      throw error;
    }
  }
);

// Get Consumable Notes
export const getConsumableNotes = async (address: string): Promise<{ notes: ConsumableNote[] }> => {
  try {
    const requestBody = {
      address: address
    };

    const response = await fetch(`${COORDINATOR_API_BASE_URL}/api/v1/consumable-notes/list`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting consumable notes:', error);
    throw error;
  }
};

// Thunk for getting consumable notes with address from localStorage
export const getConsumableNotesThunk = createAsyncThunk(
  'transaction/getConsumableNotes',
  async (_, { dispatch }) => {
    try {
      dispatch(setLoading(true));
      dispatch(setError(null));

      // Get address from localStorage
      const address = localStorage.getItem('currentWalletId');

      if (!address) {
        throw new Error('No account address found in localStorage');
      }

      const response = await getConsumableNotes(address);
      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get consumable notes';
      dispatch(setError(errorMessage));
      throw error;
    } finally {
      dispatch(setLoading(false));
    }
  }
);

// Get Transaction Stats
export const getTransactionStats = async (accountId: string): Promise<GetTransactionStatsResponse> => {
  try {
    const requestBody = {
      multisig_account_address: accountId
    };

    const response = await fetch(`${COORDINATOR_API_BASE_URL}/api/v1/multisig-tx/stats`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting transaction stats:', error);
    throw error;
  }
};

// Thunk for fetching transaction stats
export const fetchTransactionStatsThunk = createAsyncThunk(
  'walletStats/fetchTransactionStats',
  async ({ accountId }: { accountId: string }, { dispatch }) => {
    try {
      dispatch(setWalletStatsLoading(true));
      dispatch(setWalletStatsError(null));

      const response = await getTransactionStats(accountId);

      // Set wallet stats in the walletStats slice
      dispatch(setWalletStatsAction(response.tx_stats));

      return response.tx_stats;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch transaction stats';
      dispatch(setWalletStatsError(errorMessage));
      throw error;
    } finally {
      dispatch(setWalletStatsLoading(false));
    }
  }
);

// Get Approver List
export const getApproverList = async (accountId: string): Promise<GetApproverListResponse> => {
  try {
    const requestBody = {
      multisig_account_address: accountId
    };

    const response = await fetch(`${COORDINATOR_API_BASE_URL}/api/v1/multisig-account/approver/list`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting approver list:', error);
    throw error;
  }
};

// Thunk for fetching approver list
export const fetchApproverListThunk = createAsyncThunk(
  'wallet/fetchApproverList',
  async ({ accountId }: { accountId: string }, { dispatch }) => {
    try {
      dispatch(setApproversLoading(true));
      dispatch(setApproversError(null));

      const response = await getApproverList(accountId);

      // Set approvers in the wallet slice
      dispatch(setApprovers(response.approvers));

      return response.approvers;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch approver list';
      dispatch(setApproversError(errorMessage));
      throw error;
    } finally {
      dispatch(setApproversLoading(false));
    }
  }
);

// Get Multisig Account Details
export const getMultisigAccountDetails = async (accountId: string): Promise<GetMultisigAccountDetailsResponse> => {
  try {
    const requestBody = {
      multisig_account_address: accountId
    };

    const response = await fetch(`${COORDINATOR_API_BASE_URL}/api/v1/multisig-account/details`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting multisig account details:', error);
    throw error;
  }
};

// Thunk for fetching multisig account details
export const fetchMultisigAccountDetailsThunk = createAsyncThunk(
  'wallet/fetchMultisigAccountDetails',
  async ({ accountId }: { accountId: string }, { dispatch }) => {
    try {
      dispatch(setWalletDataLoading(true));
      dispatch(setWalletDataError(null));

      const response = await getMultisigAccountDetails(accountId);

      // Set wallet data in the wallet slice
      dispatch(setWalletData(response.multisig_account));

      return response.multisig_account;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch multisig account details';
      dispatch(setWalletDataError(errorMessage));
      throw error;
    } finally {
      dispatch(setWalletDataLoading(false));
    }
  }
); 