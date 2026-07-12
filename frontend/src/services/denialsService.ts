import { api } from './api';

export interface DenialRecord {
  id: string;
  tenantId: string;
  claimId?: string;
  claimNumber?: string;
  remittanceClaimId?: string;
  patientId?: string;
  patientName?: string;
  payerName?: string;
  carcCode: string;
  carcDescription?: string;
  rarcCode?: string;
  rarcDescription?: string;
  groupCode?: string;
  rootCauseCategory: string;
  deniedAmount: number;
  billedAmount: number;
  paidAmount: number;
  denialDate?: string;
  serviceDate?: string;
  filingDeadline?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'new' | 'in_progress' | 'appealed' | 'resolved' | 'written_off' | 'escalated';
  assignedTo?: string;
  assignedName?: string;
  recoveryProbability?: number;
  estimatedRecovery?: number;
  cptCode?: string;
  denialReasonText?: string;
  resolutionNotes?: string;
  resolvedAt?: string;
  createdAt: string;
}

export interface DenialStats {
  totalDenials: number;
  totalDeniedAmount: number;
  newCount: number;
  inProgressCount: number;
  appealedCount: number;
  resolvedCount: number;
  criticalCount: number;
  approachingDeadlineCount: number;
  avgRecoveryProbability: number;
}

export interface DenialAnalytics {
  totalDenials: number;
  totalDeniedAmount: number;
  byRootCause: { category: string; count: number; amount: number }[];
  byPayer: { payer: string; count: number; amount: number; denialRate: number }[];
  byPriority: { priority: string; count: number; amount: number }[];
  byStatus: { status: string; count: number; amount: number }[];
  byMonth: { month: string; count: number; amount: number }[];
  topCarcCodes: { code: string; description: string; count: number; amount: number }[];
  appealSuccessRate: number;
  recoveryRate: number;
  avgDaysToResolve: number;
}

export interface ClaimAging {
  buckets: { bucket: string; count: number; amount: number }[];
  byPayer: { payer: string; buckets: { bucket: string; count: number; amount: number }[] }[];
}

export interface PayerPerformance {
  payer: string;
  totalDenials: number;
  deniedAmount: number;
  resolvedCount: number;
  avgDaysToResolve: number;
  topRootCause: string;
}

export interface RecoveryScore {
  denialId: string;
  probability: number;
  estimatedRecovery: number;
  rationale: string;
  recommendedAction: string;
  confidenceLevel: 'low' | 'medium' | 'high';
}

export interface NlpAnalysisResult {
  denialId: string;
  extractedReason: string;
  rootCauseCategory: string;
  keywords: string[];
  sentiment: 'negative' | 'neutral' | 'positive';
  suggestedAction: string;
}

export interface DenialCluster {
  clusterId: string;
  label: string;
  rootCause: string;
  count: number;
  totalAmount: number;
  avgRecoveryProbability: number;
  commonCarcCodes: string[];
  commonPayers: string[];
  recommendedAction: string;
  denialIds: string[];
}

export interface WorklistPriority {
  denialId: string;
  rank: number;
  expectedValue: number;
  reasoning: string;
}

export const denialsService = {
  getWorklist: (params?: {
    status?: string;
    priority?: string;
    rootCause?: string;
    assignedTo?: string;
    payerName?: string;
  }): Promise<DenialRecord[]> =>
    api.get('/denials/worklist', { params }).then((r) => r.data),

  getStats: (): Promise<DenialStats> =>
    api.get('/denials/stats').then((r) => r.data),

  getAnalytics: (dateFrom?: string, dateTo?: string): Promise<DenialAnalytics> =>
    api.get('/denials/analytics', { params: { dateFrom, dateTo } }).then((r) => r.data),

  getClaimAging: (): Promise<ClaimAging> =>
    api.get('/denials/aging').then((r) => r.data),

  getPayerPerformance: (): Promise<PayerPerformance[]> =>
    api.get('/denials/payer-performance').then((r) => r.data),

  findOne: (id: string): Promise<DenialRecord> =>
    api.get(`/denials/${id}`).then((r) => r.data),

  updateStatus: (id: string, status: string, resolutionNotes?: string): Promise<DenialRecord> =>
    api.patch(`/denials/${id}/status`, { status, resolutionNotes }).then((r) => r.data),

  assign: (id: string, assignedTo: string, assignedName: string): Promise<DenialRecord> =>
    api.patch(`/denials/${id}/assign`, { assignedTo, assignedName }).then((r) => r.data),

  generateFromRemittance: (remittanceId: string): Promise<number> =>
    api.post(`/denials/generate/${remittanceId}`).then((r) => r.data),

  // AI-powered features
  aiScoreRecovery: (id: string): Promise<RecoveryScore> =>
    api.post(`/denials/ai/score/${id}`).then((r) => r.data),

  aiBatchScore: (denialIds: string[]): Promise<RecoveryScore[]> =>
    api.post('/denials/ai/score-batch', { denialIds }).then((r) => r.data),

  aiAnalyzeText: (id: string): Promise<NlpAnalysisResult> =>
    api.post(`/denials/ai/nlp/${id}`).then((r) => r.data),

  aiCluster: (limit?: number): Promise<DenialCluster[]> =>
    api.post('/denials/ai/cluster', { limit }).then((r) => r.data),

  aiPrioritize: (): Promise<WorklistPriority[]> =>
    api.post('/denials/ai/prioritize').then((r) => r.data),
};

export default denialsService;
