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
  createdAt?: string;
  updatedAt?: string;
}

export interface DocumentationEvidence {
  id: string;
  noteSection: 'subjective' | 'objective' | 'assessment' | 'plan';
  noteText: string;
  speakerLabel: string | null;
  transcriptStartMs: number | null;
  transcriptEndMs: number | null;
  sourceText: string;
  matchScore: number;
}

export interface DocumentationQualityFinding {
  severity: 'critical' | 'warning';
  section: string;
  message: string;
}

export interface DocumentationQuality {
  score: number;
  findings: DocumentationQualityFinding[];
}

export type DocumentationSuggestionKind = 'order' | 'coding' | 'cdi' | 'prior_auth' | 'after_visit_summary' | 'claim_scrub' | 'revenue_risk';
export type DocumentationSuggestionStatus = 'pending' | 'accepted' | 'dismissed';

export interface DocumentationSuggestion {
  id: string;
  sessionId: string;
  kind: DocumentationSuggestionKind;
  status: DocumentationSuggestionStatus;
  payload: Record<string, unknown>;
  evidenceText: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PayerRiskPrompt {
  payerName: string;
  denialCount: number;
  unresolvedDeniedAmount: number;
  underpaymentCount: number;
  underpaymentAmount: number;
  topRootCauses: Array<{ rootCause: string; count: number }>;
  documentationPrompts: string[];
}

export interface DocumentationNoteVersion {
  id: string;
  sessionId: string;
  versionNumber: number;
  source: 'ai_generated' | 'clinician_edited' | 'signed';
  soapNote: DocumentationSoapNote;
  createdBy: string | null;
  aiModel: string | null;
  createdAt: string;
}

export interface DocumentationPreference {
  id?: string;
  tenantId?: string;
  providerId: string;
  preferredLanguage: string;
  noteStyle: 'concise' | 'detailed' | 'narrative';
  requiredSections: string[];
  doNotInfer: string[];
  customInstructions: string | null;
}

export interface DocumentationIntelligenceBundle {
  session: DocumentationSession;
  evidence: DocumentationEvidence[];
  quality: DocumentationQuality;
  actionDrafts: DocumentationSuggestion[];
  payerPrompts: PayerRiskPrompt[];
}

export interface DocumentationSessionListResult {
  data: DocumentationSession[];
  total: number;
  page: number;
  limit: number;
}

const baseUrl = '/clinical/documentation/sessions';

export const documentationService = {
  // ── Existing methods ──
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

  // ── New methods (unified documentation surface) ──

  list: (params?: {
    patientId?: string;
    providerId?: string;
    status?: string;
    encounterId?: string;
    page?: number;
    limit?: number;
  }) => api.get<DocumentationSessionListResult>(baseUrl, { params }),

  findOne: (sessionId: string) => api.get<DocumentationSession>(`${baseUrl}/${sessionId}`),

  findOrCreateForEncounter: (encounterId: string) =>
    api.post<DocumentationSession>(`/clinical/documentation/encounters/${encounterId}/resume`),

  getWithIntelligence: (sessionId: string) =>
    api.get<DocumentationIntelligenceBundle>(`${baseUrl}/${sessionId}/intelligence`),

  getVersions: (sessionId: string) =>
    api.get<DocumentationNoteVersion[]>(`${baseUrl}/${sessionId}/versions`),

  buildEvidence: (sessionId: string) =>
    api.post<DocumentationEvidence[]>(`${baseUrl}/${sessionId}/evidence`),

  generateActionDrafts: (sessionId: string) =>
    api.post<DocumentationSuggestion[]>(`${baseUrl}/${sessionId}/action-drafts`),

  listActionDrafts: (sessionId: string) =>
    api.get<DocumentationSuggestion[]>(`${baseUrl}/${sessionId}/action-drafts`),

  reviewActionDraft: (draftId: string, status: 'accepted' | 'dismissed') =>
    api.patch<DocumentationSuggestion>(`/clinical/documentation/action-drafts/${draftId}/review`, { status }),

  getPreference: (providerId: string) =>
    api.get<DocumentationPreference | null>(`/clinical/documentation/preferences/${providerId}`),

  savePreference: (providerId: string, data: Partial<DocumentationPreference>) =>
    api.patch<DocumentationPreference>(`/clinical/documentation/preferences/${providerId}`, data),

  prepareChart: (patientId: string, providerId: string) =>
    api.get<{ summary: string; encounters: Array<{ id: string; startTime: string; chiefComplaint: string | null }> }>(
      `/clinical/documentation/previsit/${patientId}/${providerId}`,
    ),

  getRevenueRisk: (payerName: string) =>
    api.get<PayerRiskPrompt>(`/clinical/documentation/revenue-risk/payer/${encodeURIComponent(payerName)}`),

  getAppealEvidence: (sessionId: string, denialId: string) =>
    api.get<{ sessionId: string; denialId: string; evidence: Record<string, unknown> }>(
      `/clinical/documentation/sessions/${sessionId}/appeal-evidence/${denialId}`,
    ),

  sendAfterVisitSummary: (sessionId: string) =>
    api.post<{ conversationId: string; messageId: string }>(`${baseUrl}/${sessionId}/send-avs`),
};
