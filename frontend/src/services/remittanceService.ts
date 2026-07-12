import { api } from './api';

// ─── Types ────────────────────────────────────────────────────────────

export interface Remittance {
  id: string;
  tenantId: string;
  traceNumber: string;
  remittanceDate: string;
  type: 'era' | 'eob' | 'manual';
  status: 'imported' | 'posted' | 'partially_posted' | 'error' | 'reversed';
  payerId?: string;
  payerName: string;
  payerIdentifier?: string;
  paymentMethod?: string;
  paymentReference?: string;
  totalPaymentAmount: number;
  totalClaimCount: number;
  totalBilledAmount: number;
  postedCount: number;
  postedAmount: number;
  errorMessage?: string;
  fileName?: string;
  claims?: RemittanceClaim[];
  createdAt: string;
  updatedAt: string;
}

export interface RemittanceClaim {
  id: string;
  tenantId: string;
  remittanceId: string;
  payerClaimId: string;
  matchedClaimId?: string;
  matchedClaimNumber?: string;
  patientName?: string;
  patientId?: string;
  insuredName?: string;
  facilityType?: string;
  claimFrequency?: string;
  billedAmount: number;
  paidAmount: number;
  patientResponsibilityAmount: number;
  adjustedAmount: number;
  claimStatusCode: string;
  isMatched: boolean;
  isPosted: boolean;
  postedAt?: string;
  serviceDate?: string;
  serviceLines?: RemittanceServiceLine[];
  adjustments?: ClaimAdjustment[];
}

export interface RemittanceServiceLine {
  id: string;
  remittanceClaimId: string;
  cptCode: string;
  serviceIdQualifier?: string;
  modifier1?: string;
  modifier2?: string;
  modifier3?: string;
  modifier4?: string;
  units: number;
  billedAmount: number;
  paidAmount: number;
  allowedAmount?: number;
  adjustedAmount: number;
  revenueCode?: string;
  serviceDate?: string;
  matchedLineItemId?: string;
  adjustments?: ClaimAdjustment[];
}

export interface ClaimAdjustment {
  id: string;
  remittanceClaimId?: string;
  serviceLineId?: string;
  groupCode: string;
  carcCode: string;
  carcDescription?: string;
  adjustmentAmount: number;
  quantity?: number;
  rarcCode?: string;
  rarcDescription?: string;
  rootCauseCategory?: string;
}

export interface EOB {
  id: string;
  tenantId: string;
  patientId?: string;
  patientName?: string;
  claimId?: string;
  claimNumber?: string;
  payerName?: string;
  eobDate?: string;
  serviceDate?: string;
  format: 'pdf' | 'image' | 'html' | 'json';
  documentRef?: string;
  structuredData: Record<string, unknown>;
  totalBilled?: number;
  totalPaid?: number;
  patientResponsibility?: number;
  adjustmentAmount?: number;
  isDenied: boolean;
  denialCodes?: string[];
  denialReasonText?: string;
  createdAt: string;
}

export interface CarcCode {
  id: string;
  code: string;
  groupCode?: string;
  description: string;
  rootCauseCategory?: string;
  isActive: boolean;
}

export interface RarcCode {
  id: string;
  code: string;
  codeType?: string;
  description: string;
  rootCauseCategory?: string;
  isActive: boolean;
}

export interface RemittanceStats {
  totalRemittances: number;
  totalPosted: number;
  totalPending: number;
  totalPaymentAmount: number;
  totalClaimCount: number;
  unmatchedClaimCount: number;
  deniedClaimCount: number;
}

// ─── API Methods ──────────────────────────────────────────────────────

export const remittanceService = {
  // ERA
  importEra: (fileContent: string, fileName?: string): Promise<Remittance> =>
    api.post('/remittance/era/import', { fileContent, fileName }).then((r) => r.data),

  repostEra: (id: string): Promise<{ postedCount: number; postedAmount: number; unmatchedCount: number }> =>
    api.post(`/remittance/era/${id}/repost`).then((r) => r.data),

  // Remittances
  findAllRemittances: (status?: string): Promise<Remittance[]> =>
    api.get('/remittance', { params: { status } }).then((r) => r.data),

  findOneRemittance: (id: string): Promise<Remittance> =>
    api.get(`/remittance/${id}`).then((r) => r.data),

  getRemittanceClaims: (id: string): Promise<RemittanceClaim[]> =>
    api.get(`/remittance/${id}/claims`).then((r) => r.data),

  findOneRemittanceClaim: (claimId: string): Promise<RemittanceClaim> =>
    api.get(`/remittance/claims/${claimId}`).then((r) => r.data),

  // Stats
  getStats: (): Promise<RemittanceStats> =>
    api.get('/remittance/stats').then((r) => r.data),

  // EOB
  importEob: (data: Partial<EOB>): Promise<EOB> =>
    api.post('/remittance/eob', data).then((r) => r.data),

  findAllEobs: (patientId?: string): Promise<EOB[]> =>
    api.get('/remittance/eob', { params: { patientId } }).then((r) => r.data),

  findOneEob: (id: string): Promise<EOB> =>
    api.get(`/remittance/eob/${id}`).then((r) => r.data),

  // CARC/RARC
  findCarcCodes: (q?: string): Promise<CarcCode[]> =>
    api.get('/remittance/codes/carc', { params: { q } }).then((r) => r.data),

  findRarcCodes: (q?: string): Promise<RarcCode[]> =>
    api.get('/remittance/codes/rarc', { params: { q } }).then((r) => r.data),

  findOneCarc: (code: string): Promise<CarcCode> =>
    api.get(`/remittance/codes/carc/${code}`).then((r) => r.data),

  findOneRarc: (code: string): Promise<RarcCode> =>
    api.get(`/remittance/codes/rarc/${code}`).then((r) => r.data),
};

export default remittanceService;
