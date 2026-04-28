import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
 
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
 
const getAuthHeader = () => ({
  headers: {
    Authorization: `Bearer ${localStorage.getItem('token')}`
  }
});
 
export const createInvoice = createAsyncThunk(
  'invoice/create',
  async (data: any) => {
    const response = await axios.post(
      `${API_URL}/invoices`,
      data,
      getAuthHeader()
    );
    return response.data;
  }
);
 
export const fetchInvoices = createAsyncThunk(
  'invoice/fetchAll',
  async ({ companyId, month, year }: any) => {
    const params = new URLSearchParams();
    if (month) params.append('month', String(month));
    if (year) params.append('year', String(year));
 
    const response = await axios.get(
      `${API_URL}/invoices/${companyId}?${params}`,
      getAuthHeader()
    );
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