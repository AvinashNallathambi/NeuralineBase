import axios from 'axios';
import { message } from 'antd';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';

// Create centralized axios instance
export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem('neuraline_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      message.info('Logged out due to security concern');
      
      // Clear session storage
      sessionStorage.clear();
      
      // Redirect to login
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;