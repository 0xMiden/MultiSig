import { configureStore } from '@reduxjs/toolkit';
import walletReducer from './slices/walletSlice';
import transactionReducer from './slices/transactionSlice';
import signatureReducer from './slices/signatureSlice';
import walletStatsReducer from './slices/walletStatsSlice';
import { RootState, AppDispatch } from '@/types';

export const store = configureStore({
  reducer: {
    wallet: walletReducer,
    transaction: transactionReducer,
    signature: signatureReducer,
    walletStats: walletStatsReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
      },
    }),
});

export type { RootState, AppDispatch }; 