import { api } from './api';
import type { Patient } from './patientService';

export interface PatientLoginResponse {
  accessToken: string;
  refreshToken: string;
  patient: Partial<Patient> & {
    portalActive?: boolean;
    lastLoginAt?: string | null;
  };
  mfaRequired: boolean;
}

export interface PatientDashboard {
  upcomingAppointments: number;
  activePrescriptions: number;
  pendingLabResults: number;
  unpaidInvoices: number;
  outstandingBalance: number;
  totalEobs: number;
  recentAppointments: any[];
  recentPrescriptions: any[];
  recentLabs: any[];
  recentInvoices: any[];
  recentEobs: any[];
}

const PATIENT_TOKEN_KEY = 'neuraline_patient_token';
const PATIENT_USER_KEY = 'neuraline_patient_user';

class PatientAuthServiceClass {
  private baseUrl = '/patients/auth';

  async login(email: string, password: string, tenantId: string): Promise<PatientLoginResponse> {
    const response = await api.post(`${this.baseUrl}/login`, { email, password, tenantId });
    const data = response.data;
    if (data.accessToken) {
      sessionStorage.setItem(PATIENT_TOKEN_KEY, data.accessToken);
      sessionStorage.setItem(PATIENT_USER_KEY, JSON.stringify(data.patient));
    }
    return data;
  }

  async setupAccount(patientId: string, password: string, tenantId: string): Promise<{ message: string }> {
    const response = await api.post(`${this.baseUrl}/${patientId}/setup-account?tenantId=${tenantId}`, { password });
    return response.data;
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    const response = await api.post(`${this.baseUrl}/refresh`, { refreshToken });
    return response.data;
  }

  async logout(): Promise<void> {
    try {
      await api.post(`${this.baseUrl}/logout`, {});
    } catch {
      // Ignore errors on logout
    }
    sessionStorage.removeItem(PATIENT_TOKEN_KEY);
    sessionStorage.removeItem(PATIENT_USER_KEY);
  }

  async forgotPassword(email: string, tenantId: string): Promise<{ message: string }> {
    const response = await api.post(`${this.baseUrl}/forgot-password`, { email, tenantId });
    return response.data;
  }

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    const response = await api.post(`${this.baseUrl}/reset-password`, { token, newPassword });
    return response.data;
  }

  async getMe(): Promise<Partial<Patient>> {
    const response = await api.get(`${this.baseUrl}/me`);
    return response.data;
  }

  getToken(): string | null {
    return sessionStorage.getItem(PATIENT_TOKEN_KEY);
  }

  getCurrentPatient(): Partial<Patient> | null {
    const raw = sessionStorage.getItem(PATIENT_USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }
}

export const patientAuthService = new PatientAuthServiceClass();
export default patientAuthService;
