import axios from 'axios';
import { message } from 'antd';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';

// Create centralized axios instance
export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

// Request interceptor to add auth token
// Checks both staff token and patient portal token
api.interceptors.request.use(
  (config) => {
    // For patient portal endpoints, use patient token
    const url = config.url || '';
    const isPatientEndpoint = url.startsWith('/patients/auth') || url.startsWith('/patients/portal');

    if (isPatientEndpoint) {
      const patientToken = sessionStorage.getItem('neuraline_patient_token');
      if (patientToken) {
        config.headers.Authorization = `Bearer ${patientToken}`;
      }
    } else {
      const token = sessionStorage.getItem('neuraline_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
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
      const url = error.config?.url || '';
      const isPatientEndpoint = url.startsWith('/patients/auth') || url.startsWith('/patients/portal');

      if (isPatientEndpoint) {
        // Patient token expired — redirect to patient login
        sessionStorage.removeItem('neuraline_patient_token');
        sessionStorage.removeItem('neuraline_patient_user');
        if (window.location.pathname.startsWith('/portal')) {
          message.info('Your session has expired. Please sign in again.');
          window.location.href = '/patient/login';
        }
      } else {
        // Staff token expired
        message.info('Logged out due to security concern');
        sessionStorage.clear();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
