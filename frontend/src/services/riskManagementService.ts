import { api } from './api';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface RiskFactor {
  factor: string;
  severity: 'low' | 'moderate' | 'high';
  modifiable: boolean;
  domain: 'clinical' | 'medication' | 'social' | 'behavioral';
  detail?: string;
}

export interface PredictedRisk {
  outcome: string;
  probability: string;
  timeframe: string;
}

export interface RiskRecommendation {
  action: string;
  priority: 'high' | 'medium' | 'low';
  rationale: string;
}

export interface CompositeRisk {
  riskLevel: string;
  riskScore: number;
  riskFactors: RiskFactor[];
  predictedRisks: PredictedRisk[];
  recommendations: RiskRecommendation[];
  careManagementEnrollment: boolean;
  summary: string;
}

export interface ClinicalRiskScore {
  name: string;
  score: number;
  maxScore: number;
  riskLevel: 'low' | 'moderate' | 'high' | 'very_high';
  description: string;
  recommendation: string;
  components?: { label: string; points: number }[];
  applicable: boolean;
}

export interface MedicationRiskItem {
  category: string;
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  description: string;
  medications?: string[];
  recommendation: string;
  detail?: any;
}

export interface MedicationRisk {
  items: MedicationRiskItem[];
  opioidMme: number | null;
  opioidRiskLevel: string | null;
  polypharmacyCount: number;
  highRiskMedications: string[];
}

export interface CareGap {
  gap: string;
  category: string;
  severity: 'low' | 'moderate' | 'high';
  recommendation: string;
  guideline?: string;
  dueDate?: string;
}

export interface QualityMeasure {
  measure: string;
  status: 'met' | 'not_met' | 'overdue';
  lastValue?: string;
  targetValue?: string;
}

export interface DataSummary {
  conditionCount: number;
  medicationCount: number;
  allergyCount: number;
  activeProblems: string[];
  recentVitals: { metric: string; value: string }[];
  recentLabs: { test: string; value: string; unit?: string; date?: string }[];
}

export interface RiskManagementProfile {
  patientId: string;
  patientName: string;
  patientAge: number | null;
  patientSex: string | null;
  generatedAt: string;
  compositeRisk: CompositeRisk | null;
  clinicalScores: ClinicalRiskScore[];
  medicationRisk: MedicationRisk;
  careGaps: CareGap[];
  qualityMeasures: QualityMeasure[];
  careGapSummary: string | null;
  dataSummary: DataSummary;
}

class RiskManagementService {
  private baseUrl = '/risk-management';

  async getPatientRiskProfile(patientId: string): Promise<RiskManagementProfile> {
    const response = await api.get(`${this.baseUrl}/patients/${patientId}`);
    return response.data.data;
  }
}

export const riskManagementService = new RiskManagementService();
