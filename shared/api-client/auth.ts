/**
 * Auth API client — pure functions, no platform dependencies.
 */
import type { AxiosInstance } from 'axios';
import type { User, Tenant } from '../types';

export interface LoginRequest {
  email: string;
  password: string; // RSA-OAEP encrypted (base64) — encrypted by the client
  tenantId?: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken?: string;
  user: User;
  tenant: Tenant;
  mfaRequired?: boolean;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken?: string;
}

export class AuthApi {
  constructor(private http: AxiosInstance) {}

  getPublicKey(): Promise<{ publicKey: string }> {
    return this.http.get('/auth/public-key').then((r) => r.data);
  }

  login(req: LoginRequest): Promise<LoginResponse> {
    return this.http.post('/auth/login', req).then((r) => r.data);
  }

  logout(): Promise<void> {
    return this.http.post('/auth/logout').then((r) => r.data);
  }

  refresh(refreshToken: string): Promise<RefreshResponse> {
    return this.http.post('/auth/refresh', { refreshToken }).then((r) => r.data);
  }

  forgotPassword(email: string, tenantId?: string): Promise<void> {
    return this.http.post('/auth/forgot-password', { email, tenantId }).then((r) => r.data);
  }

  me(): Promise<{ user: User; tenant: Tenant }> {
    return this.http.get('/auth/me').then((r) => r.data);
  }
}
