import { api } from './api';

export interface PayerContract {
  id: string;
  tenantId: string;
  payerId?: string;
  payerName: string;
  cptCode: string;
  cptDescription?: string;
  contractedRate: number;
  rateType: string;
  medicarePercentage?: number;
  effectiveDate?: string;
  expirationDate?: string;
  isActive: boolean;
}

export interface UnderpaymentRecord {
  id: string;
  tenantId: string;
  claimId?: string;
  claimNumber?: string;
  payerName: string;
  cptCode: string;
  billedAmount: number;
  expectedAmount: number;
  actualPaidAmount: number;
  varianceAmount: number;
  variancePercentage?: number;
  contractedRate?: number;
  status: 'detected' | 'investigating' | 'disputed' | 'recovered' | 'written_off' | 'false_positive';
  patientName?: string;
  serviceDate?: string;
  paymentDate?: string;
  recoveredAmount?: number;
  resolutionNotes?: string;
  createdAt: string;
}

export interface UnderpaymentStats {
  totalUnderpayments: number;
  totalVariance: number;
  totalRecovered: number;
  detectedCount: number;
  investigatingCount: number;
  disputedCount: number;
  recoveredCount: number;
  byPayer: { payer: string; count: number; variance: number; recovered: number }[];
  byCptCode: { cptCode: string; count: number; variance: number }[];
}

export const underpaymentsService = {
  createContract: (data: Partial<PayerContract>): Promise<PayerContract> =>
    api.post('/underpayments/contracts', data).then((r) => r.data),

  findAllContracts: (payerName?: string): Promise<PayerContract[]> =>
    api.get('/underpayments/contracts', { params: { payerName } }).then((r) => r.data),

  detect: (remittanceId: string): Promise<{ detectedCount: number; totalVariance: number }> =>
    api.post(`/underpayments/detect/${remittanceId}`).then((r) => r.data),

  findAll: (status?: string): Promise<UnderpaymentRecord[]> =>
    api.get('/underpayments', { params: { status } }).then((r) => r.data),

  getStats: (): Promise<UnderpaymentStats> =>
    api.get('/underpayments/stats').then((r) => r.data),

  findOne: (id: string): Promise<UnderpaymentRecord> =>
    api.get(`/underpayments/${id}`).then((r) => r.data),

  updateStatus: (id: string, data: { status: string; recoveredAmount?: number; notes?: string }): Promise<UnderpaymentRecord> =>
    api.patch(`/underpayments/${id}/status`, data).then((r) => r.data),
};

export default underpaymentsService;
