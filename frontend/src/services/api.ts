import axios from 'axios';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Handle requests - Manually attach token to bypass strict 3rd-party cookie blockers
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
      // Fallback headers in case backend middleware expects something else
      config.headers['x-auth-token'] = token;
      config.headers['token'] = token;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve();
    }
  });
  failedQueue = [];
};

// Handle responses
api.interceptors.response.use(
(response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry && window.location.pathname !== '/login' && window.location.pathname !== '/signup' && !originalRequest.url?.includes('/auth/refresh')) {
      if (isRefreshing) {
        return new Promise(function(resolve, reject) {
          failedQueue.push({ resolve, reject });
        }).then(() => api(originalRequest)).catch(err => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');

        // DEBUG: Prevent useless backend calls if we already know the token is missing
        if (!refreshToken) {
          console.error('[API DEBUG] No refresh token found in localStorage! Bypassing refresh attempt.');
          throw new Error('No refresh token provided');
        }

        const res = await axios.post(`${API_URL}/auth/refresh`, { refreshToken }, { withCredentials: true });
        
        if (res.data.token) {
          localStorage.setItem('token', res.data.token);
          if (res.data.refreshToken) {
            localStorage.setItem('refreshToken', res.data.refreshToken);
          }
          originalRequest.headers.Authorization = `Bearer ${res.data.token}`;
        }
        isRefreshing = false;
        processQueue(null);
        return api(originalRequest);
      } catch (err) {
        isRefreshing = false;
        processQueue(err);
        console.error('[API DEBUG] Refresh flow failed. Wiping local storage.', err);
        localStorage.removeItem('token'); // CRITICAL: Clear token to break the infinite redirect loop
        localStorage.removeItem('refreshToken');
        // Removed aggressive hard redirect. Let React Router handle it gracefully!
        return Promise.reject(err);
      }
    }
    return Promise.reject(error);
  }
);
export default api;