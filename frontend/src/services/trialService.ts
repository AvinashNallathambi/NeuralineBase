import api from './api';

export type TrialRequestStatus =
  | 'pending'
  | 'approved'
  | 'active'
  | 'rejected'
  | 'disabled'
  | 'converted'
  | 'expired'
  | 'wiped';

export type TrialPlanType = 'solo' | 'professional' | 'enterprise';

export interface TrialRequest {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  practiceName: string;
  planType: TrialPlanType;
  status: TrialRequestStatus;
  tenantId: string | null;
  adminUserId: string | null;
  trialEndsAt: string | null;
  disabledAt: string | null;
  convertedAt: string | null;
  wipedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTrialRequestDto {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  practiceName: string;
  planType: TrialPlanType;
  notes?: string;
}

export interface ApproveTrialRequestDto {
  trialDays?: number;
  notes?: string;
}

const ADMIN_BASE = '/trials/admin';

export const trialService = {
  /** Public: submit a demo / trial request from the marketing website */
  createRequest: (data: CreateTrialRequestDto): Promise<TrialRequest> =>
    api.post('/trials', data).then((r) => r.data),

  /** Admin: list all trial requests */
  getAll: (status?: TrialRequestStatus): Promise<TrialRequest[]> =>
    api.get(ADMIN_BASE, { params: status ? { status } : undefined }).then((r) => r.data),

  /** Admin: get a single trial request */
  getOne: (id: string): Promise<TrialRequest> =>
    api.get(`${ADMIN_BASE}/${id}`).then((r) => r.data),

  /** Admin: approve a request and provision the tenant */
  approve: (id: string, data?: ApproveTrialRequestDto): Promise<{ request: TrialRequest; password: string }> =>
    api.post(`${ADMIN_BASE}/${id}/approve`, data).then((r) => r.data),

  /** Admin: reject a request */
  reject: (id: string, notes?: string): Promise<TrialRequest> =>
    api.post(`${ADMIN_BASE}/${id}/reject`, { notes }).then((r) => r.data),

  /** Admin: disable an active account */
  disable: (id: string, notes?: string): Promise<TrialRequest> =>
    api.post(`${ADMIN_BASE}/${id}/disable`, { notes }).then((r) => r.data),

  /** Admin or owner: convert to paid and keep data */
  convert: (id: string): Promise<TrialRequest> =>
    api.post(`${ADMIN_BASE}/${id}/convert`).then((r) => r.data),

  /** Admin or owner: wipe data and convert to paid */
  wipe: (id: string): Promise<TrialRequest> =>
    api.post(`${ADMIN_BASE}/${id}/wipe`).then((r) => r.data),
};
