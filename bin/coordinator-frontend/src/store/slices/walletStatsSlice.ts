import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { TransactionStats } from '@/types';

interface WalletStatsState {
  stats: TransactionStats | null;
  loading: boolean;
  error: string | null;
}

const initialState: WalletStatsState = {
  stats: null,
  loading: false,
  error: null,
};

const walletStatsSlice = createSlice({
  name: 'walletStats',
  initialState,
  reducers: {
    setWalletStats: (state, action: PayloadAction<TransactionStats>) => {
      state.stats = action.payload;
      state.error = null;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.loading = false;
    },
    clearWalletStats: (state) => {
      state.stats = null;
      state.error = null;
      state.loading = false;
    },
  },
});

export const { setWalletStats, setLoading, setError, clearWalletStats } = walletStatsSlice.actions;
export default walletStatsSlice.reducer;

