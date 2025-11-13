import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { addSignatureThunk } from '../../services/signatureApi';

interface SignatureState {
  loading: boolean;
  error: string | null;
  lastSignatureResult: boolean | null;
}

const initialState: SignatureState = {
  loading: false,
  error: null,
  lastSignatureResult: null,
};

const signatureSlice = createSlice({
  name: 'signature',
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    clearSignatureState: (state) => {
      state.loading = false;
      state.error = null;
      state.lastSignatureResult = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Add signature thunk cases
      .addCase(addSignatureThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(addSignatureThunk.fulfilled, (state) => {
        state.loading = false;
        state.lastSignatureResult = true;
      })
      .addCase(addSignatureThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to add signature';
        state.lastSignatureResult = false;
      });
  },
});

export const { setLoading, setError, clearSignatureState } = signatureSlice.actions;
export default signatureSlice.reducer; 