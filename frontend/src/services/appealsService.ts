import { api } from './api';

export interface Appeal {
  id: string;
  tenantId: string;
  denialId: string;
  claimId?: string;
  claimNumber?: string;
  appealNumber: string;
  appealType: string;
  status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'denied' | 'partially_approved' | 'escalated' | 'withdrawn';
  outcome: 'pending' | 'overturned' | 'upheld' | 'partially_overturned';
  payerName?: string;
  patientName?: string;
  carcCode?: string;
  denialReason?: string;
  deniedAmount: number;
  appealLetter?: string;
  appealSubject?: string;
  supportingDocuments: string[];
  successProbability?: number;
  aiRationale?: string;
  submittedDate?: string;
  responseDate?: string;
  deadlineDate?: string;
  recoveredAmount?: number;
  resolutionNotes?: string;
  submittedByName?: string;
  statusHistory?: AppealStatusHistory[];
  createdAt: string;
}

export interface AppealStatusHistory {
  id: string;
  status: string;
  changedByName?: string;
  notes?: string;
  createdAt: string;
}

export interface AppealStats {
  totalAppeals: number;
  pendingCount: number;
  submittedCount: number;
  approvedCount: number;
  deniedCount: number;
  totalRecovered: number;
  successRate: number;
  avgSuccessProbability: number;
}

export const appealsService = {
  createFromDenial: (denialId: string): Promise<Appeal> =>
    api.post(`/appeals/from-denial/${denialId}`).then((r) => r.data),

  generateLetter: (id: string): Promise<Appeal> =>
    api.post(`/appeals/${id}/generate-letter`).then((r) => r.data),

  predictSuccess: (id: string): Promise<{ probability: number; rationale: string }> =>
    api.post(`/appeals/${id}/predict-success`).then((r) => r.data),

  submit: (id: string): Promise<Appeal> =>
    api.post(`/appeals/${id}/submit`).then((r) => r.data),

  findAll: (status?: string): Promise<Appeal[]> =>
    api.get('/appeals', { params: { status } }).then((r) => r.data),

  getStats: (): Promise<AppealStats> =>
    api.get('/appeals/stats').then((r) => r.data),

  findOne: (id: string): Promise<Appeal> =>
    api.get(`/appeals/${id}`).then((r) => r.data),

  updateStatus: (id: string, data: {
    status: string;
    outcome?: string;
    recoveredAmount?: number;
    notes?: string;
  }): Promise<Appeal> =>
    api.patch(`/appeals/${id}/status`, data).then((r) => r.data),
};

export default appealsService;
