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
};

export default aiService;
