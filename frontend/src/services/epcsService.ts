import { api } from './api';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type DeaSchedule = 'II' | 'III' | 'IV' | 'V';

export interface ControlledSubstanceInfo {
  name: string;
  genericName: string;
  schedule: DeaSchedule;
  deaClass: string;
  commonStrengths: string[];
  mmePerUnit?: number;
  isOpioid: boolean;
  isBenzodiazepine: boolean;
  unit: string;
}

export interface ProviderEpcsEnrollment {
  id: string;
  tenantId: string;
  userId: string;
  userName: string;
  deaNumber: string;
  npiNumber: string;
  stateLicense?: string;
  practiceState?: string;
  identityProofingStatus: string;
  identityProofedAt?: string;
  twoFactorMethod?: string;
  twoFactorEnrolledAt?: string;
  accessControlGranted: boolean;
  accessControlGrantedByName?: string;
  accessControlGrantedAt?: string;
  status: string;
  sureScriptsSpi?: string;
  isEpcsReady?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PdmpQuery {
  id: string;
  patientId: string;
  patientName: string;
  providerId: string;
  providerName: string;
  state: string;
  queryStatus: string;
  csPrescriptionCount: number;
  prescriberCount: number;
  pharmacyCount: number;
  totalMme: number;
  earlyRefillCount: number;
  riskLevel: string;
  riskScore: number;
  redFlags: string[];
  recommendations: string[];
  aiSummary?: string;
  createdAt: string;
}

export interface EpcsAuditLog {
  id: string;
  action: string;
  prescriptionId?: string;
  userId?: string;
  userName?: string;
  patientName?: string;
  medication?: string;
  deaSchedule?: string;
  twoFactorMethod?: string;
  twoFactorSuccess?: boolean;
  transmissionId?: string;
  pharmacyName?: string;
  description?: string;
  entryHash: string;
  previousHash?: string;
  createdAt: string;
}

export interface OpioidRiskScore {
  patientId: string;
  riskScore: number;
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  contributingFactors: string[];
  recommendedActions: string[];
  confidenceLevel: string;
  modelVersion: string;
  generatedAt: string;
}

export interface DiversionCheckResult {
  patientId: string;
  riskScore: number;
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  redFlags: Array<{ type: string; description: string; severity: string; detail: string }>;
  recommendation: string;
  shouldBlock: boolean;
}

export interface AlternativeTherapy {
  alternatives: Array<{
    medication: string;
    class: string;
    rationale: string;
    evidenceLevel: string;
    typicalDose: string;
    advantages: string[];
    precautions: string[];
  }>;
  reasoning: string;
}

export interface PdmpSummary {
  summary: string;
  riskLevel: string;
  keyFindings: string[];
  recommendations: string[];
  redFlags: string[];
}

export interface BehavioralNudge {
  nudgeType: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  alternativeSuggestions: string[];
  actionable: boolean;
}

export interface QuantityOptimization {
  withinGuidelines: boolean;
  recommendedQuantity: number | null;
  recommendedDuration: string | null;
  currentQuantity: number;
  percentOver: number | null;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  cdcGuideline: string;
}

export interface AnomalyDetectionResult {
  anomalies: Array<{
    providerId: string;
    providerName: string;
    type: string;
    description: string;
    severity: string;
  }>;
  totalProvidersChecked: number;
  anomalyCount: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  schedule: DeaSchedule;
}

// ─────────────────────────────────────────────────────────────────────────────
// EPCS Service
// ─────────────────────────────────────────────────────────────────────────────

export const epcsService = {
  // ── Enrollment ────────────────────────────────────────────────────────────
  getMyEnrollment: () => api.get('/epcs/enrollments/me').then((r) => r.data),
  getEnrollments: () => api.get('/epcs/enrollments').then((r) => r.data),
  startEnrollment: (data: { deaNumber: string; npiNumber: string; stateLicense?: string; practiceState?: string }) =>
    api.post('/epcs/enrollments', data).then((r) => r.data),
  completeIdentityProofing: (id: string, verifiedByUserId: string, method?: string) =>
    api.post(`/epcs/enrollments/${id}/identity-proofing`, { verifiedByUserId, method }).then((r) => r.data),
  setupTwoFactor: (id: string, method?: string) =>
    api.post(`/epcs/enrollments/${id}/two-factor/setup`, { method }).then((r) => r.data),
  verifyTwoFactor: (id: string, token: string) =>
    api.post(`/epcs/enrollments/${id}/two-factor/verify`, { token }).then((r) => r.data),
  grantAccessControl: (id: string, data: { grantedByUserId: string; grantedByName: string }) =>
    api.post(`/epcs/enrollments/${id}/access-control`, data).then((r) => r.data),
  suspendEnrollment: (id: string, reason: string) =>
    api.post(`/epcs/enrollments/${id}/suspend`, { reason }).then((r) => r.data),

  // ── Signing ───────────────────────────────────────────────────────────────
  signPrescription: (prescriptionId: string, twoFactorToken: string) =>
    api.post(`/epcs/prescriptions/${prescriptionId}/sign`, { twoFactorToken }).then((r) => r.data),
  cancelPrescription: (prescriptionId: string, reason: string) =>
    api.post(`/epcs/prescriptions/${prescriptionId}/cancel`, { reason }).then((r) => r.data),

  // ── PDMP ──────────────────────────────────────────────────────────────────
  queryPdmp: (data: { patientId: string; patientName: string; state: string }) =>
    api.post('/epcs/pdmp/query', data).then((r) => r.data),
  getPdmpHistory: (patientId: string) =>
    api.get(`/epcs/pdmp/patient/${patientId}`).then((r) => r.data),

  // ── Audit ─────────────────────────────────────────────────────────────────
  getAuditLogs: (page?: number, limit?: number) =>
    api.get('/epcs/audit-logs', { params: { page, limit } }).then((r) => r.data),
  getPrescriptionAuditTrail: (prescriptionId: string) =>
    api.get(`/epcs/audit-logs/prescription/${prescriptionId}`).then((r) => r.data),
  verifyAuditChain: () => api.get('/epcs/audit-logs/verify').then((r) => r.data),

  // ── Transmission ──────────────────────────────────────────────────────────
  getTransmissionLogs: (prescriptionId?: string) =>
    api.get('/epcs/transmission-logs', { params: { prescriptionId } }).then((r) => r.data),

  // ── Controlled Substances ─────────────────────────────────────────────────
  searchControlledSubstances: (q: string, limit?: number) =>
    api.get('/epcs/medications/search', { params: { q, limit } }).then((r) => r.data),
  getBySchedule: (schedule: DeaSchedule) =>
    api.get(`/epcs/medications/schedule/${schedule}`).then((r) => r.data),
  validate: (data: { schedule: DeaSchedule; quantity: number; refills: number; daysSupply?: number; state?: string }) =>
    api.post('/epcs/validate', data).then((r) => r.data),
  validateDeaNumber: (deaNumber: string) =>
    api.post('/epcs/validate/dea-number', { deaNumber }).then((r) => r.data),
  getEpcsMandateStates: () => api.get('/epcs/states/epcs-mandates').then((r) => r.data),

  // ── AI Features ───────────────────────────────────────────────────────────
  scoreOpioidRisk: (data: { patientId: string; patientName: string; proposedMedication: string; patientContext?: any }) =>
    api.post('/epcs/ai/opioid-risk-score', data).then((r) => r.data),
  detectDiversion: (data: { patientId: string; patientName: string; pdmpQueryId?: string }) =>
    api.post('/epcs/ai/diversion-check', data).then((r) => r.data),
  recommendAlternatives: (data: { proposedMedication: string; diagnosis?: string; patientContext?: any }) =>
    api.post('/epcs/ai/alternative-therapy', data).then((r) => r.data),
  generatePdmpSummary: (data: { pdmpQueryId: string; patientName: string }) =>
    api.post('/epcs/ai/pdmp-summary', data).then((r) => r.data),
  generateNudge: (data: { providerId: string; providerName: string; proposedMedication: string; patientRiskScore?: any }) =>
    api.post('/epcs/ai/behavioral-nudge', data).then((r) => r.data),
  optimizeQuantity: (data: { medicationName: string; quantity: number; daysSupply?: number; isAcutePain?: boolean }) =>
    api.post('/epcs/ai/quantity-optimizer', data).then((r) => r.data),
  detectAnomalies: () => api.post('/epcs/ai/anomaly-detection').then((r) => r.data),

  // ── MME ───────────────────────────────────────────────────────────────────
  calculateMme: (data: { medicationName: string; strength: number; quantityPerDay: number }) =>
    api.post('/epcs/mme/calculate', data).then((r) => r.data),
};
