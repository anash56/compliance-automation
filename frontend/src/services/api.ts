import axios from 'axios';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      const headers = config.headers as Record<string, string> | undefined;
      config.headers = {
        ...headers,
        Authorization: `Bearer ${token}`
      } as any;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);
// Handle responses
api.interceptors.response.use(
(response) => response,
(error) => {
if (error.response?.status === 401) {
localStorage.removeItem('token');
window.location.href = '/login';
}
return Promise.reject(error);
}
);
export default api;