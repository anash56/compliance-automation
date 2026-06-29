import axios from 'axios';

// In production, use the relative path '/api' so Vercel securely proxies it to Render
const API_URL = import.meta.env.MODE === 'production' ? '/api' : 'http://localhost:5000/api';

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add a request interceptor to include the token
api.interceptors.request.use(
  (config) => {
    // This is a placeholder as we are using httpOnly cookies.
    // If you were using localStorage, you would get the token here.
    // const token = localStorage.getItem('token');
    // if (token) {
    //   config.headers['Authorization'] = `Bearer ${token}`;
    // }
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

    // Only attempt to refresh for non-auth routes.
    // Public routes like /forgot-password should be ignored by this interceptor.
    const isAuthApiCall = originalRequest.url && originalRequest.url.includes('/auth/'); 

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthApiCall) {
      if (isRefreshing) {
        return new Promise(function(resolve, reject) {
          failedQueue.push({ resolve, reject });
        }).then(() => api(originalRequest)).catch(err => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await api.post('/auth/refresh'); // Use the configured api instance
        isRefreshing = false;
        processQueue(null);
        return api(originalRequest);
      } catch (err) {
        isRefreshing = false;
        // Clear cookies and redirect
        document.cookie = "token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        document.cookie = "refreshToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";

        processQueue(err);
        window.location.href = '/login';
        return Promise.reject(err);
      }
    }
    return Promise.reject(error);
  }
);
export default api;