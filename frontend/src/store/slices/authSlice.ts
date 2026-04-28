import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { User } from '../../types';
 
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
 
export const signup = createAsyncThunk(
  'auth/signup',
  async ({ email, password, fullName }: any) => {
    const response = await axios.post(`${API_URL}/auth/signup`, {
      email,
      password,
      fullName
    });
    // Don't set token for signup, user needs to login
    return { user: response.data.user };
  }
);
 
export const login = createAsyncThunk(
  'auth/login',
  async ({ email, password }: any) => {
    const response = await axios.post(`${API_URL}/auth/login`, {
      email,
      password
    });
    localStorage.setItem('token', response.data.token);
    return response.data;
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
        state.user = action.payload.user;
        // Don't set token for signup
      })
      .addCase(signup.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Signup failed';
      })
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Login failed';
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.token = null;
      });
  }
});
 
export const { clearError } = authSlice.actions;
export default authSlice.reducer;