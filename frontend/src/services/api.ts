import axios from 'axios';

// In production, use the relative path '/api' so Vercel securely proxies it to Render
const API_URL = import.meta.env.MODE === 'production' ? '/api' : 'http://localhost:5000/api';

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 10000, // ⏱️ 10-second timeout to prevent UI freeze during cold starts
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add a request interceptor to include the token from localStorage
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
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

    // Exclude public auth endpoints from trigger-refresh attempts
    const isPublicAuthApiCall = originalRequest.url && (
      originalRequest.url.includes('/auth/login') ||
      originalRequest.url.includes('/auth/signup') ||
      originalRequest.url.includes('/auth/refresh') ||
      originalRequest.url.includes('/auth/verify-2fa') ||
      originalRequest.url.includes('/auth/forgot-password') ||
      originalRequest.url.includes('/auth/reset-password')
    );

    if (error.response?.status === 401 && !originalRequest._retry && !isPublicAuthApiCall) {
      if (isRefreshing) {
        return new Promise(function(resolve, reject) {
          failedQueue.push({ resolve, reject });
        }).then(() => api(originalRequest)).catch(err => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshRes = await api.post('/auth/refresh');
        if (refreshRes.data?.token) {
          localStorage.setItem('token', refreshRes.data.token);
        }
        isRefreshing = false;
        processQueue(null);
        return api(originalRequest);
      } catch (err) {
        isRefreshing = false;
        localStorage.removeItem('token');
        document.cookie = "token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        document.cookie = "refreshToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";

        processQueue(err);
        return Promise.reject(err);
      }
    }
    return Promise.reject(error);
  }
);
export default api;