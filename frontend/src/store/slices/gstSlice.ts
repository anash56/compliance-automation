import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';
 
export const generateGSTR1 = createAsyncThunk(
  'gst/generateGSTR1',
  async ({ companyId, month, year }: any) => {
    const response = await api.post('/gst/gstr1/generate', { companyId, month, year });
    return response.data;
  }
);
 
export const generateGSTR3B = createAsyncThunk(
  'gst/generateGSTR3B',
  async ({ companyId, month, year }: any) => {
    const response = await api.post('/gst/gstr3b/generate', { companyId, month, year });
    return response.data;
  }
);
 
export const fetchGSTReturns = createAsyncThunk(
  'gst/fetchReturns',
  async (companyId: string) => {
    const response = await api.get(`/gst/returns/${companyId}`);
    return response.data;
  }
);
 
const gstSlice = createSlice({
  name: 'gst',
  initialState: {
    returns: [] as any[],
    currentGSTR1: null,
    currentGSTR3B: null,
    loading: false,
    error: null as string | null
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(generateGSTR1.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(generateGSTR1.fulfilled, (state, action) => {
        state.loading = false;
        state.currentGSTR1 = action.payload.gstr1;
      })
      .addCase(generateGSTR1.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to generate GSTR-1';
      })
      .addCase(generateGSTR3B.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(generateGSTR3B.fulfilled, (state, action) => {
        state.loading = false;
        state.currentGSTR1 = action.payload.gstr1;
        state.currentGSTR3B = action.payload.gstr3b;
      })
      .addCase(generateGSTR3B.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to generate GSTR-3B';
      })
      .addCase(fetchGSTReturns.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchGSTReturns.fulfilled, (state, action) => {
        state.loading = false;
        state.returns = action.payload.returns;
      })
      .addCase(fetchGSTReturns.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch GST returns';
      });
  }
});
 
export default gstSlice.reducer;