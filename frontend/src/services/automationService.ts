import { api } from './api';

export interface PipelineResult {
  remittanceId: string;
  steps: {
    eraImported: boolean;
    paymentsPosted: { postedCount: number; postedAmount: number; unmatchedCount: number };
    denialsGenerated: number;
    underpaymentsDetected: { detectedCount: number; totalVariance: number };
    denialsScored: number;
    highValueAppealsCreated: number;
  };
  errors: string[];
}

export interface PreSubmissionClaim {
  payerName: string;
  payerId?: string;
  patientId?: string;
  patientName?: string;
  cptCodes: string[];
  diagnosisCodes: string[];
  modifiers?: string[];
  placeOfService?: string;
  serviceDate?: string;
  billedAmount: number;
  providerNPI?: string;
  providerName?: string;
  priorAuthorizationNumber?: string;
  eligibilityVerified?: boolean;
  hasMedicalNecessity?: boolean;
  hasReferral?: boolean;
}

export interface DenialRiskAssessment {
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  predictedDenialReasons: {
    reason: string;
    probability: number;
    carcCode?: string;
    preventable: boolean;
    preventionAction?: string;
  }[];
  recommendations: string[];
  estimatedDenialCost: number;
  confidenceLevel: 'low' | 'medium' | 'high';
}

export const automationService = {
  runPipeline: (data: {
    remittanceId: string;
    autoPost?: boolean;
    generateDenials?: boolean;
    detectUnderpayments?: boolean;
    aiScoreDenials?: boolean;
    autoCreateAppeals?: boolean;
    appealThreshold?: number;
  }): Promise<PipelineResult> =>
    api.post('/automation/pipeline/' + data.remittanceId, data).then((r) => r.data),

  getPipelineStatus: (): Promise<any> =>
    api.get('/automation/pipeline/status').then((r) => r.data),

  assessClaimRisk: (claim: PreSubmissionClaim): Promise<DenialRiskAssessment> =>
    api.post('/automation/prevention/assess', claim).then((r) => r.data),

  quickRiskCheck: (claim: PreSubmissionClaim): Promise<{ riskScore: number; flags: string[] }> =>
    api.post('/automation/prevention/quick-check', claim).then((r) => r.data),
};

export default automationService;
