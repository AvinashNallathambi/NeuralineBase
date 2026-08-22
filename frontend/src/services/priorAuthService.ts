import { api } from './api';
import type {
  PriorAuthRequest,
  PriorAuthAttachment,
  PriorAuthRequirement,
  PriorAuthDashboard,
  PriorAuthStatus,
  PriorAuthBenefitType,
  PriorAuthSubmissionMethod,
  PriorAuthUrgency,
  PriorAuthCode,
  PriorAuthDiagnosis,
  RequirementCheckResult,
  AutoTriggerPaResult,
  AiRequirementPrediction,
  AiApprovalPrediction,
  AiExpirationPrediction,
} from '../types';

const BASE = '/prior-auth';

export const priorAuthService = {
  // ── CRUD ───────────────────────────────────────────────────────────
  async create(data: {
    patientId: string;
    patientName?: string;
    encounterId?: string;
    superbillId?: string;
    providerId?: string;
    providerName?: string;
    benefitType?: PriorAuthBenefitType;
    urgency?: PriorAuthUrgency;
    payerName?: string;
    payerId?: string;
    planName?: string;
    policyNumber?: string;
    groupNumber?: string;
    eligibilityVerificationId?: string;
    procedureCodes: PriorAuthCode[];
    diagnosisCodes?: PriorAuthDiagnosis[];
    clinicalNotes?: string;
    serviceDate?: string;
    estimatedCost?: number;
    assignedTo?: string;
    priority?: number;
    notes?: string;
  }): Promise<PriorAuthRequest> {
    const response = await api.post(`${BASE}`, data);
    return response.data;
  },

  async list(params?: {
    patientId?: string;
    status?: PriorAuthStatus;
    payerName?: string;
    assignedTo?: string;
  }): Promise<PriorAuthRequest[]> {
    const response = await api.get(`${BASE}`, { params });
    return response.data;
  },

  async getWorklist(params?: {
    status?: PriorAuthStatus;
    assignedTo?: string;
    payerName?: string;
    priority?: number;
  }): Promise<PriorAuthRequest[]> {
    const response = await api.get(`${BASE}/worklist`, { params });
    return response.data;
  },

  async getDashboard(): Promise<PriorAuthDashboard> {
    const response = await api.get(`${BASE}/dashboard`);
    return response.data;
  },

  async getOne(id: string): Promise<PriorAuthRequest> {
    const response = await api.get(`${BASE}/${id}`);
    return response.data;
  },

  async update(id: string, data: Partial<{
    urgency: PriorAuthUrgency;
    payerName: string;
    payerId: string;
    planName: string;
    policyNumber: string;
    groupNumber: string;
    procedureCodes: PriorAuthCode[];
    diagnosisCodes: PriorAuthDiagnosis[];
    clinicalNotes: string;
    authLetter: string;
    serviceDate: string;
    estimatedCost: number;
    assignedTo: string;
    priority: number;
    notes: string;
  }>): Promise<PriorAuthRequest> {
    const response = await api.patch(`${BASE}/${id}`, data);
    return response.data;
  },

  async cancel(id: string, reason?: string): Promise<PriorAuthRequest> {
    const response = await api.delete(`${BASE}/${id}`, { data: { reason } });
    return response.data;
  },

  // ── Lifecycle ──────────────────────────────────────────────────────
  async submit(id: string, data: {
    submissionMethod: PriorAuthSubmissionMethod;
    authLetter?: string;
  }): Promise<PriorAuthRequest> {
    const response = await api.post(`${BASE}/${id}/submit`, data);
    return response.data;
  },

  async recordPayerResponse(id: string, data: {
    status: 'approved' | 'denied' | 'pending' | 'p2p_scheduled';
    authNumber?: string;
    approvedStartDate?: string;
    approvedEndDate?: string;
    visitCountApproved?: number;
    denialReason?: string;
    denialCode?: string;
    payerDecisionNotes?: string;
    p2pScheduledAt?: string;
  }): Promise<PriorAuthRequest> {
    const response = await api.post(`${BASE}/${id}/payer-response`, data);
    return response.data;
  },

  async createNewVersion(id: string): Promise<PriorAuthRequest> {
    const response = await api.post(`${BASE}/${id}/new-version`);
    return response.data;
  },

  async assign(id: string, assignedTo: string): Promise<PriorAuthRequest> {
    const response = await api.post(`${BASE}/${id}/assign`, { assignedTo });
    return response.data;
  },

  async setPriority(id: string, priority: number): Promise<PriorAuthRequest> {
    const response = await api.patch(`${BASE}/${id}/priority`, { priority });
    return response.data;
  },

  // ── Attachments ────────────────────────────────────────────────────
  async addAttachment(id: string, data: {
    attachmentType: string;
    title: string;
    description?: string;
    content?: string;
    fileUrl?: string;
    fileName?: string;
    mimeType?: string;
    evidenceDate?: string;
    isAiGenerated?: boolean;
    satisfiesCriterion?: string;
  }): Promise<PriorAuthAttachment> {
    const response = await api.post(`${BASE}/${id}/attachments`, data);
    return response.data;
  },

  async getAttachments(id: string): Promise<PriorAuthAttachment[]> {
    const response = await api.get(`${BASE}/${id}/attachments`);
    return response.data;
  },

  async deleteAttachment(attachmentId: string): Promise<void> {
    await api.delete(`${BASE}/attachments/${attachmentId}`);
  },

  // ── Requirement Lookup ─────────────────────────────────────────────
  async checkRequirement(data: {
    payerName: string;
    procedureCodes: string[];
    diagnosisCodes?: string[];
    patientId?: string;
    encounterId?: string;
  }): Promise<RequirementCheckResult[]> {
    const response = await api.post(`${BASE}/check-requirement`, data);
    return response.data;
  },

  async getRequirements(payerName?: string): Promise<PriorAuthRequirement[]> {
    const response = await api.get(`${BASE}/requirements`, { params: { payerName } });
    return response.data;
  },

  async seedRequirements(): Promise<{ seeded: number }> {
    const response = await api.post(`${BASE}/requirements/seed`);
    return response.data;
  },

  // ── P1: AI Features ────────────────────────────────────────────────

  /** A2: Auto-trigger PA at order entry */
  async autoTriggerPa(data: {
    patientId: string;
    encounterId?: string;
    payerName?: string;
    policyNumber?: string;
    procedureCodes: PriorAuthCode[];
    diagnosisCodes?: PriorAuthDiagnosis[];
    clinicalNotes?: string;
    serviceDate?: string;
  }): Promise<AutoTriggerPaResult> {
    const response = await api.post(`${BASE}/auto-trigger`, data);
    return response.data;
  },

  /** A1: Predict PA requirement */
  async runRequirementPrediction(id: string): Promise<PriorAuthRequest> {
    const response = await api.post(`${BASE}/${id}/ai/requirement-prediction`);
    return response.data;
  },

  /** A4: Predict approval probability */
  async runApprovalPrediction(id: string): Promise<PriorAuthRequest> {
    const response = await api.post(`${BASE}/${id}/ai/approval-prediction`);
    return response.data;
  },

  /** A6: Predict expiration */
  async runExpirationPrediction(id: string): Promise<PriorAuthRequest> {
    const response = await api.post(`${BASE}/${id}/ai/expiration-prediction`);
    return response.data;
  },

  /** A3: Auto-assemble clinical evidence */
  async assembleEvidence(id: string, chartData: any): Promise<{
    evidence: any;
    attachments: any[];
    coverageGaps: string[];
  }> {
    const response = await api.post(`${BASE}/${id}/ai/assemble-evidence`, { chartData });
    return response.data;
  },

  /** A5: P2P review prep */
  async prepareP2P(id: string): Promise<{
    likelyDenialRationale: string;
    counterArguments: Array<{ point: string; supportingEvidence: string }>;
    similarApprovedCases: string[];
    talkingPoints: string[];
    recommendedStrategy: string;
  }> {
    const response = await api.post(`${BASE}/${id}/ai/p2p-prep`);
    return response.data;
  },

  /** A7: Learn from denial */
  async learnFromDenial(id: string): Promise<{
    insights: Array<{ insight: string; action: string; appliesTo: string }>;
    registryUpdate: { payerName: string; procedureCode: string; newCriteria: string[] } | null;
  }> {
    const response = await api.post(`${BASE}/${id}/ai/learn-from-denial`);
    return response.data;
  },

  // ── Expiration Check ───────────────────────────────────────────────
  async checkExpirations(): Promise<{ expired: number; expiringSoon: number }> {
    const response = await api.post(`${BASE}/check-expirations`);
    return response.data;
  },
};
