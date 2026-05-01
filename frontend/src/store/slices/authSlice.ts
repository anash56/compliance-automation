import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';
import { User } from '../../types';

const getAuthErrorMessage = (error: any, fallback: string) => {
  if (!error.response && error.message === 'Network Error') {
    return 'Cannot reach the backend API. Make sure the backend is running on port 5000 and the frontend URL is allowed by CORS.';
  }

  return error.response?.data?.error || error.message || fallback;
};
 
export const signup = createAsyncThunk(
  'auth/signup',
  async ({ email, password, fullName }: any, { rejectWithValue }) => {
    try {
      const response = await api.post('/auth/signup', {
        email,
        password,
        fullName
      });
      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
      }
      return response.data;
    } catch (error: any) {
      return rejectWithValue(getAuthErrorMessage(error, 'Signup failed'));
    }
  }
);
 
export const login = createAsyncThunk(
  'auth/login',
  async ({ email, password }: any, { rejectWithValue }) => {
    try {
      const response = await api.post('/auth/login', {
        email,
        password
      });
      localStorage.setItem('token', response.data.token);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(getAuthErrorMessage(error, 'Login failed'));
    }
  }
);
 
export const logout = createAsyncThunk(
  'auth/logout',
  async () => {
    localStorage.removeItem('token');
    return null;
  }
);
 
const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null as User | null,
    token: localStorage.getItem('token'),
    loading: false,
    error: null as string | null
  },
  reducers: {
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(signup.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(signup.fulfilled, (state, action) => {
        state.loading = false;
        state.error = null;
        state.user = action.payload.user;
        if (action.payload.token) {
          state.token = action.payload.token;
        }
      })
      .addCase(signup.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || action.error.message || 'Signup failed';
      })
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false;
        state.error = null;
        state.user = action.payload.user;
        state.token = action.payload.token;
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || action.error.message || 'Login failed';
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.token = null;
      });
  }
});
 
export const { clearError } = authSlice.actions;
export default authSlice.reducer;
