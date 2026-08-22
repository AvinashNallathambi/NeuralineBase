import api from './api';

export interface MeasureResult {
  measureId: string;
  measureTitle: string;
  program: string;
  category: string;
  status: 'met' | 'not_met' | 'overdue' | 'not_applicable';
  lastValue: string | null;
  targetValue: string | null;
  lastEventDate: string | null;
  explanation: string;
  recommendation: string | null;
  closeableInVisit: boolean;
  suggestedAction: string | null;
  priority: number;
  crossProgramMappings: Array<{ program: string; measureId: string; measureTitle: string }>;
  dataElements: Array<{ source: string; field: string; value: string; date?: string }>;
}

export interface QualitySummary {
  total: number;
  met: number;
  notMet: number;
  overdue: number;
  notApplicable: number;
  complianceRate: number;
  openGaps: number;
  closeableGaps: number;
  estimatedQualityScore: number;
}

export interface AiRecommendations {
  topPriorities: Array<{ measureId: string; title: string; action: string; impact: string }>;
  visitReadiness: Array<{ measureId: string; title: string; action: string }>;
  summary: string;
}

export interface PatientQualityProfile {
  patientId: string;
  patientName: string;
  patientAge: number | null;
  patientSex: string | null;
  generatedAt: string;
  reportingPeriod: { start: string; end: string };
  measures: MeasureResult[];
  summary: QualitySummary;
  aiRecommendations: AiRecommendations | null;
}

export interface PracticeMeasureSummary {
  measureId: string;
  measureTitle: string;
  program: string;
  category: string;
  eligible: number;
  met: number;
  notMet: number;
  overdue: number;
  complianceRate: number;
}

export interface PracticeQualityDashboard {
  tenantId: string;
  generatedAt: string;
  reportingPeriod: { start: string; end: string };
  totalPatients: number;
  measures: PracticeMeasureSummary[];
  overallCompliance: number;
  estimatedQualityScore: number;
  topGaps: Array<{ measureId: string; measureTitle: string; gapCount: number; complianceRate: number }>;
  aiInsights: string | null;
}

export interface MeasureDefinition {
  id: string;
  title: string;
  program: string;
  category: string;
  description: string;
  targetValue?: string;
  closeableInVisit: boolean;
  suggestedAction?: string;
  priority: number;
}

const BASE_URL = '/quality-measures';

export const qualityMeasuresService = {
  async getPatientQualityProfile(patientId: string): Promise<PatientQualityProfile> {
    const response = await api.get(`${BASE_URL}/patients/${patientId}`);
    return response.data;
  },

  async getPracticeDashboard(): Promise<PracticeQualityDashboard> {
    const response = await api.get(`${BASE_URL}/dashboard`);
    return response.data;
  },

  async getMeasureRegistry(): Promise<MeasureDefinition[]> {
    const response = await api.get(`${BASE_URL}/registry`);
    return response.data;
  },
};
