import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
  fetchPendingTransactions,
  fetchConfirmedTransactions,
  createTransactionThunk,
  proposeTransactionWithTxBzThunk,
  getConsumableNotesThunk
} from '../../services/transactionApi';
import { Transaction, ConsumableNote } from '../../types';

interface TransactionState {
  pendingTransactions: Transaction[];
  allTransactions: Transaction[];
  consumableNotes: ConsumableNote[];
  loading: boolean;
  error: string | null;
  currentTransactionId: string | null;
}

const initialState: TransactionState = {
  pendingTransactions: [],
  allTransactions: [],
  consumableNotes: [],
  loading: false,
  error: null,
  currentTransactionId: null,
};

const transactionSlice = createSlice({
  name: 'transaction',
  initialState,
  reducers: {
    setPendingTransactions: (state, action: PayloadAction<Transaction[]>) => {
      state.pendingTransactions = action.payload;
    },
    setAllTransactions: (state, action: PayloadAction<Transaction[]>) => {
      state.allTransactions = action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    setCurrentTransactionId: (state, action: PayloadAction<string | null>) => {
      state.currentTransactionId = action.payload;
    },
    clearCurrentTransactionId: (state) => {
      state.currentTransactionId = null;
    },
    clearPendingTransactions: (state) => {
      state.pendingTransactions = [];
    },
    clearAllTransactions: (state) => {
      state.allTransactions = [];
    },
    clearTransactions: (state) => {
      state.pendingTransactions = [];
      state.allTransactions = [];
      state.error = null;
      state.currentTransactionId = null;
    },
    setConsumableNotes: (state, action: PayloadAction<ConsumableNote[]>) => {
      state.consumableNotes = action.payload;
    },
    clearConsumableNotes: (state) => {
      state.consumableNotes = [];
    },
  },
  extraReducers: (builder) => {
    builder
      // Pending transactions thunk cases
      .addCase(fetchPendingTransactions.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPendingTransactions.fulfilled, (state, action) => {
        state.loading = false;
        state.pendingTransactions = action.payload;
      })
      .addCase(fetchPendingTransactions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch pending transactions';
      })
      // Confirmed transactions thunk cases
      .addCase(fetchConfirmedTransactions.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchConfirmedTransactions.fulfilled, (state, action) => {
        state.loading = false;
        state.allTransactions = action.payload;
      })
      .addCase(fetchConfirmedTransactions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch confirmed transactions';
      })
      // Create transaction thunk cases
      .addCase(createTransactionThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createTransactionThunk.fulfilled, (state, action) => {
        state.loading = false;
        // Store the transaction ID from the result
        if (action.payload && action.payload.tx_id) {
          state.currentTransactionId = action.payload.tx_id;
        }
      })
      .addCase(createTransactionThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to create transaction';
      })
      // Propose transaction with tx_bz thunk cases
      .addCase(proposeTransactionWithTxBzThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(proposeTransactionWithTxBzThunk.fulfilled, (state, action) => {
        state.loading = false;
        // Store the transaction ID from the result
        if (action.payload && action.payload.tx_id) {
          state.currentTransactionId = action.payload.tx_id;
        }
        // Transaction list will be refreshed by other thunks
      })
      .addCase(proposeTransactionWithTxBzThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to propose transaction';
      })
      // Get consumable notes thunk cases
      .addCase(getConsumableNotesThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getConsumableNotesThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.consumableNotes = action.payload;
      })
      .addCase(getConsumableNotesThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to get consumable notes';
      });
  },
});

export const {
  setPendingTransactions,
  setAllTransactions,
  setLoading,
  setError,
  setCurrentTransactionId,
  clearCurrentTransactionId,
  clearPendingTransactions,
  clearAllTransactions,
  clearTransactions,
  setConsumableNotes,
  clearConsumableNotes,
} = transactionSlice.actions;

export type { TransactionState, Transaction };
export default transactionSlice.reducer; 