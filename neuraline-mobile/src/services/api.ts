/**
 * API Client — the RN-flavored axios instance.
 *
 * Wraps the shared @neuraline/shared API client with:
 * - Keychain-based token storage (replaces web's sessionStorage)
 * - Imperative navigation on 401 (replaces web's window.location.href)
 * - X-App-Version header for force-update support
 *
 * HIPAA: No request bodies are logged. Sentry beforeSend strips PHI.
 */

import { createApiClient, AuthApi, PatientAuthApi, PatientsApi, AppointmentsApi, DashboardApi } from '@neuraline/shared';
import { getSecureToken, clearSecureToken, type TokenScope } from './secureTokenStorage';
import { navigateToLogin, navigateToPatientLogin } from './navigationRef';

// Absolute URL — the dev proxy (/api/v1) does not work in a native app.
// Set via env or fallback to localhost for development.
// In production, use react-native-config or Expo env to inject these.
//
// NOTE: 10.0.2.2 is the Android emulator's alias for the host machine's
// localhost. On a physical device, use your computer's LAN IP instead
// (e.g. http://192.168.1.100:4000/api/v1).
const API_BASE_URL = (process.env as any).API_URL || 'http://10.0.2.2:4000/api/v1';
const APP_VERSION = (process.env as any).APP_VERSION || '1.0.0';

export const http = createApiClient({ baseURL: API_BASE_URL, timeout: 30000 });

// ── Request interceptor: attach Bearer token from Keychain ──────────────────
http.interceptors.request.use(
  async (config) => {
    const url = config.url || '';
    const isPatientEndpoint =
      url.startsWith('/patients/auth') ||
      url.startsWith('/patients/portal') ||
      url.startsWith('/messaging/patient/');

    const scope: TokenScope = isPatientEndpoint ? 'patient' : 'staff';
    const token = await getSecureToken(scope);

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // App version header — backend can force-update old builds
    config.headers['X-App-Version'] = APP_VERSION;
    config.headers['X-App-Platform'] = 'mobile';

    return config;
  },
  (error) => Promise.reject(error),
);

// ── Response interceptor: handle 401 by clearing token + navigating ─────────
http.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const url = error.config?.url || '';
      const isPatientEndpoint =
        url.startsWith('/patients/auth') ||
        url.startsWith('/patients/portal') ||
        url.startsWith('/messaging/patient/');

      const scope: TokenScope = isPatientEndpoint ? 'patient' : 'staff';
      await clearSecureToken(scope);

      if (isPatientEndpoint) {
        navigateToPatientLogin();
      } else {
        navigateToLogin();
      }
    }
    return Promise.reject(error);
  },
);

// ── API client instances ────────────────────────────────────────────────────
export const authApi = new AuthApi(http);
export const patientAuthApi = new PatientAuthApi(http);
export const patientsApi = new PatientsApi(http);
export const appointmentsApi = new AppointmentsApi(http);
export const dashboardApi = new DashboardApi(http);

export { http as api };
