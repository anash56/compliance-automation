import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';
 
export const createInvoice = createAsyncThunk(
  'invoice/create',
  async (data: any) => {
    const response = await api.post('/invoices', data);
    return response.data;
  }
);
 
export const fetchInvoices = createAsyncThunk(
  'invoice/fetchAll',
  async ({ companyId, month, year }: any) => {
    const params = new URLSearchParams();
    if (month) params.append('month', String(month));
    if (year) params.append('year', String(year));
 
    const response = await api.get(`/invoices/${companyId}?${params}`);
    return response.data;
  }
);
 
const invoiceSlice = createSlice({
  name: 'invoice',
  initialState: {
    invoices: [] as any[],
    loading: false,
    error: null as string | null
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(createInvoice.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createInvoice.fulfilled, (state, action) => {
        state.loading = false;
        state.invoices.push(action.payload.invoice);
      })
      .addCase(createInvoice.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to create invoice';
      })
      .addCase(fetchInvoices.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchInvoices.fulfilled, (state, action) => {
        state.loading = false;
        state.invoices = action.payload.invoices;
      })
      .addCase(fetchInvoices.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch invoices';
      });
  }
});
 
export default invoiceSlice.reducer;