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

export const aiService = {
  generateSoap: (data: GenerateSoapRequest) =>
    api.post<SoapNoteResponse>('/ai/generate-soap', data),

  suggestCodes: (data: SuggestCodesRequest) =>
    api.post<SuggestCodesResponse>('/ai/suggest-codes', data),

  health: () => api.get<{ status: string; model: string; available: boolean }>('/ai/health'),
};

export default aiService;
