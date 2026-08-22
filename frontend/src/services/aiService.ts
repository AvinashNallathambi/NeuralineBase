import { api } from './api';

export interface GenerateSoapRequest {
  transcript: string;
  patientContext?: {
    name?: string;
    age?: number;
    gender?: string;
    chiefComplaint?: string;
  };
}

export interface SoapNoteResponse {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

export interface SuggestCodesRequest {
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
}

export interface CodeSuggestion {
  code: string;
  description: string;
  confidence: number;
  rationale: string;
  suggestedModifiers?: string[];
}

export interface SuggestCodesResponse {
  diagnoses: CodeSuggestion[];
  procedures: CodeSuggestion[];
}

export interface SuggestDiagnosisRequest {
  query: string;
  limit?: number;
}

export interface DiagnosisSuggestion {
  code: string;
  description: string;
  confidence: number;
  rationale: string;
}

export interface SuggestDiagnosisResponse {
  suggestions: DiagnosisSuggestion[];
}

export interface ReviewMedication {
  medication: string;
  dosage: string;
  frequency: string;
  route?: string;
  duration?: string;
  quantity?: number;
  refills?: number;
  rxNormCode?: string;
}

export interface ReviewMedicationsRequest {
  medications: ReviewMedication[];
  allergies?: string[];
  conditions?: string[];
  age?: number;
  gender?: string;
}

export interface MedicationIssue {
  severity: 'error' | 'warning' | 'info';
  message: string;
}

export interface ReviewMedicationsResponse {
  score: number;
  summary: string;
  issues: MedicationIssue[];
}

export interface ParsePrescriptionRequest {
  transcript: string;
}

export interface ParsedMedication {
  medication: string;
  dosage: string;
  frequency: string;
  route: string;
  duration: string;
  quantity: number;
  refills: number;
  instructions: string;
}

export interface ParsePrescriptionResponse {
  medications: ParsedMedication[];
  notes?: string;
}

// ── Care Plan AI ──

export interface GenerateCarePlanRequest {
  patientName: string;
  patientAge?: number;
  patientSex?: string;
  conditions: Array<{ condition: string; code?: string; codeSystem?: string; icd10Code?: string }>;
  currentMedications: Array<{ name: string; dosage?: string }>;
  recentLabs?: Array<{ test: string; value: string; unit?: string; date?: string }>;
  vitals?: Array<{ metric: string; value: string; date?: string }>;
  allergies?: string[];
  providerName?: string;
}

export interface AICarePlanResponse {
  title: string;
  description: string;
  category: string;
  addresses: Array<{ condition: string; code?: string; codeSystem?: string; icd10Code?: string; description: string; severity?: string }>;
  goals: Array<{
    description: string;
    targetValue?: string;
    targetUnit?: string;
    metricName?: string;
    targetDirection?: string;
    priority?: string;
    targetDate?: string;
  }>;
  tasks: Array<{
    title: string;
    description?: string;
    taskType: string;
    assignedTo: string;
    frequency: string;
    priority?: string;
    metricName?: string;
    targetValue?: string;
    targetUnit?: string;
  }>;
  patientEducation: Array<{ title: string; content: string }>;
  careTeam: Array<{ role: string; description?: string }>;
}

export interface SuggestMonitoringTasksRequest {
  conditions: Array<{ condition: string; code?: string; codeSystem?: string; icd10Code?: string }>;
  currentMedications: Array<{ name: string; dosage?: string }>;
  recentLabs?: Array<{ test: string; value: string; unit?: string }>;
}

export interface RiskStratificationRequest {
  patientName: string;
  patientAge?: number;
  patientSex?: string;
  conditions: Array<{ condition: string; code?: string; codeSystem?: string; icd10Code?: string }>;
  currentMedications: Array<{ name: string }>;
  recentLabs?: Array<{ test: string; value: string; unit?: string }>;
  vitals?: Array<{ metric: string; value: string }>;
  hospitalizationsLastYear?: number;
  edVisitsLastYear?: number;
}

export interface CareGapDetectionRequest {
  patientAge?: number;
  patientSex?: string;
  conditions: Array<{ condition: string; code?: string; codeSystem?: string; icd10Code?: string }>;
  currentMedications: Array<{ name: string }>;
  recentLabs?: Array<{ test: string; value: string; date?: string }>;
  lastImaging?: Array<{ type: string; date?: string }>;
  immunizations?: Array<{ name: string; date?: string }>;
  lastAppointmentDate?: string;
}

export const aiService = {
  generateSoap: (data: GenerateSoapRequest) =>
    api.post<SoapNoteResponse>('/ai/generate-soap', data),

  suggestCodes: (data: SuggestCodesRequest) =>
    api.post<SuggestCodesResponse>('/ai/suggest-codes', data),

  suggestDiagnosis: (data: SuggestDiagnosisRequest) =>
    api.post<SuggestDiagnosisResponse>('/ai/suggest-diagnosis', data),

  reviewMedications: (data: ReviewMedicationsRequest) =>
    api.post<ReviewMedicationsResponse>('/ai/review-medications', data),

  parsePrescription: (data: ParsePrescriptionRequest) =>
    api.post<ParsePrescriptionResponse>('/ai/parse-prescription', data),

  health: () => api.get<{ status: string; model: string; available: boolean }>('/ai/health'),

  // Care Plan AI
  generateCarePlan: (data: GenerateCarePlanRequest) =>
    api.post<AICarePlanResponse>('/ai/generate-care-plan', data),

  suggestMonitoringTasks: (data: SuggestMonitoringTasksRequest) =>
    api.post<any>('/ai/suggest-monitoring-tasks', data),

  riskStratification: (data: RiskStratificationRequest) =>
    api.post<any>('/ai/risk-stratification', data),

  careGapDetection: (data: CareGapDetectionRequest) =>
    api.post<any>('/ai/care-gap-detection', data),
};

export default aiService;
