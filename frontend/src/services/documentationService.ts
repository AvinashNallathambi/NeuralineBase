import { api } from './api';

export type DocumentationConsentStatus = 'pending' | 'granted' | 'declined' | 'provider_dictation';

export interface DocumentationSoapNote {
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
}

export interface DocumentationSession {
  id: string;
  tenantId: string;
  encounterId: string | null;
  patientId: string;
  providerId: string;
  status: 'draft' | 'transcribed' | 'note_generated' | 'reviewed' | 'signed' | 'cancelled';
  consentStatus: DocumentationConsentStatus;
  consentCapturedAt: string | null;
  consentMethod: string | null;
  audioRetentionPolicy: 'delete_after_transcription';
  audioDeletedAt: string | null;
  transcript: string | null;
  transcriptLanguage: string | null;
  transcriptConfidence: number | null;
  transcriptUtterances: Array<{ speaker: string; text: string; start: number; end: number; confidence: number }>;
  soapNote: DocumentationSoapNote;
  signedAt: string | null;
  signedBy: string | null;
}

const baseUrl = '/clinical/documentation/sessions';

export const documentationService = {
  createSession: (data: {
    patientId: string;
    providerId?: string;
    encounterId?: string;
    consentStatus: DocumentationConsentStatus;
    consentMethod?: string;
  }) => api.post<DocumentationSession>(baseUrl, data),

  transcribe: (sessionId: string, file: Blob) => {
    const formData = new FormData();
    formData.append('file', file, 'encounter.webm');
    return api.post<DocumentationSession>(`${baseUrl}/${sessionId}/transcribe`, formData);
  },

  saveTranscript: (sessionId: string, transcript: string, languageCode?: string) =>
    api.patch<DocumentationSession>(`${baseUrl}/${sessionId}/transcript`, { transcript, languageCode }),

  generateNote: (sessionId: string) => api.post<DocumentationSession>(`${baseUrl}/${sessionId}/generate-note`),

  updateNote: (sessionId: string, soapNote: DocumentationSoapNote) =>
    api.patch<DocumentationSession>(`${baseUrl}/${sessionId}/note`, soapNote),

  applyToEncounter: (sessionId: string) =>
    api.post<DocumentationSession>(`${baseUrl}/${sessionId}/apply-to-encounter`),

  sign: (sessionId: string) => api.post<DocumentationSession>(`${baseUrl}/${sessionId}/sign`),
};
