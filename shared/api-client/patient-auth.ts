/**
 * Patient portal auth API client — pure functions, no platform dependencies.
 */
import type { AxiosInstance } from 'axios';
import type { Patient } from '../types';

export interface PatientLoginRequest {
  email: string;
  password: string;
  tenantId?: string;
}

export interface PatientLoginResponse {
  accessToken: string;
  refreshToken: string;
  patient: Partial<Patient> & {
    portalActive?: boolean;
    lastLoginAt?: string | null;
  };
  mfaRequired: boolean;
}

export class PatientAuthApi {
  constructor(private http: AxiosInstance) {}

  login(req: PatientLoginRequest): Promise<PatientLoginResponse> {
    return this.http.post('/patients/auth/login', req).then((r) => r.data);
  }

  logout(): Promise<void> {
    return this.http.post('/patients/auth/logout').then((r) => r.data);
  }

  refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    return this.http.post('/patients/auth/refresh', { refreshToken }).then((r) => r.data);
  }

  me(): Promise<{ patient: Partial<Patient> }> {
    return this.http.get('/patients/auth/me').then((r) => r.data);
  }

  forgotPassword(email: string, tenantId?: string): Promise<void> {
    return this.http.post('/patients/auth/forgot-password', { email, tenantId }).then((r) => r.data);
  }
}
