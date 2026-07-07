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

export const aiService = {
  generateSoap: (data: GenerateSoapRequest) =>
    api.post<SoapNoteResponse>('/ai/generate-soap', data),

  suggestCodes: (data: SuggestCodesRequest) =>
    api.post<SuggestCodesResponse>('/ai/suggest-codes', data),

  suggestDiagnosis: (data: SuggestDiagnosisRequest) =>
    api.post<SuggestDiagnosisResponse>('/ai/suggest-diagnosis', data),

  health: () => api.get<{ status: string; model: string; available: boolean }>('/ai/health'),
};

export default aiService;
