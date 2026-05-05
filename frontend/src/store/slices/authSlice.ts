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
      return response.data;
    } catch (error: any) {
      return rejectWithValue(getAuthErrorMessage(error, 'Signup failed'));
    }
  }
);
 
export const login = createAsyncThunk(
  'auth/login',
  async ({ email, password, rememberMe }: any, { rejectWithValue }) => {
    try {
      const response = await api.post('/auth/login', {
        email,
        password,
        rememberMe
      });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(getAuthErrorMessage(error, 'Login failed'));
    }
  }
);

export const socialLogin = createAsyncThunk(
  'auth/socialLogin',
  async ({ provider, code }: any, { rejectWithValue }) => {
    try {
      const response = await api.post('/auth/oauth/callback', { provider, code });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(getAuthErrorMessage(error, `${provider} login failed`));
    }
  }
);

export const verify2FA = createAsyncThunk(
  'auth/verify2FA',
  async ({ tempToken, code }: any, { rejectWithValue }) => {
    try {
      const response = await api.post('/auth/verify-2fa', { tempToken, code });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(getAuthErrorMessage(error, 'Invalid 2FA code'));
    }
  }
);

export const fetchCurrentUser = createAsyncThunk(
  'auth/me',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/auth/me');
      return response.data;
    } catch (error: any) {
      return rejectWithValue(getAuthErrorMessage(error, 'Failed to restore session'));
    }
  }
);
 
export const logout = createAsyncThunk(
  'auth/logout',
  async () => {
    await api.post('/auth/logout');
    localStorage.removeItem('selectedCompanyId');
    return null;
  }
);
 
const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null as User | null,
    loading: false,
    error: null as string | null,
    require2FA: false,
    tempToken: null as string | null
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
      .addCase(signup.fulfilled, (state) => {
        state.loading = false;
        state.error = null;
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
        if (action.payload.require2FA) {
          state.require2FA = true;
          state.tempToken = action.payload.tempToken;
        } else {
          state.user = action.payload.user;
          state.require2FA = false;
          state.tempToken = null;
        }
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || action.error.message || 'Login failed';
      })
      .addCase(socialLogin.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(socialLogin.fulfilled, (state, action) => {
        state.loading = false;
        state.error = null;
        if (action.payload.require2FA) {
          state.require2FA = true;
          state.tempToken = action.payload.tempToken;
        } else {
          state.user = action.payload.user;
          state.require2FA = false;
          state.tempToken = null;
        }
      })
      .addCase(socialLogin.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || action.error.message || 'Social login failed';
      })
      .addCase(verify2FA.fulfilled, (state, action) => {
        state.loading = false;
        state.error = null;
        state.user = action.payload.user;
        state.require2FA = false;
        state.tempToken = null;
      })
      .addCase(verify2FA.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || action.error.message || 'Invalid code';
      })
      .addCase(fetchCurrentUser.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchCurrentUser.fulfilled, (state, action) => {
        state.loading = false;
        state.error = null;
        state.user = action.payload.user;
      })
      .addCase(fetchCurrentUser.rejected, (state) => {
        state.loading = false;
        state.user = null;
        localStorage.removeItem('selectedCompanyId');
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.require2FA = false;
        state.tempToken = null;
      });
  }
});
 
export const { clearError } = authSlice.actions;
export default authSlice.reducer;
