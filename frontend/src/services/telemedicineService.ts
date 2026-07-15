import { api } from './api';

export interface TelemedicineSession {
  id: string;
  tenantId: string;
  appointmentId: string | null;
  patientId: string;
  providerId: string;
  roomId: string;
  status: string;
  participants: Array<{
    userId: string;
    role: 'provider' | 'patient' | 'interpreter';
    name: string;
    joinedAt?: string;
    leftAt?: string;
  }>;
  chatMessages: Array<{
    id: string;
    senderId: string;
    senderName: string;
    senderRole: string;
    text: string;
    sentAt: string;
  }>;
  sharedFiles: Array<{
    id: string;
    fileName: string;
    fileType: string;
    url: string;
    uploadedBy: string;
    uploadedAt: string;
  }>;
  startedAt: string | null;
  endedAt: string | null;
  durationMinutes: number | null;
  recordingConsent: boolean;
  recordingStatus: string;
  transcript: string | null;
  soapNote: {
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
  };
  suggestedCodes: {
    diagnoses?: Array<{ code: string; description: string; confidence: number; rationale: string }>;
    procedures?: Array<{ code: string; description: string; confidence: number; rationale: string; suggestedModifiers?: string[] }>;
  } | null;
  encounterId: string | null;
  superbillId: string | null;
  providerNotes: string | null;
  createdAt: string;
}

export interface CreateSessionDto {
  appointmentId?: string;
  patientId: string;
  providerId: string;
  enableRecording?: boolean;
  recordingConsent?: boolean;
}

export interface SessionToken {
  token: string;
  roomUrl: string;
  roomId: string;
}

class TelemedicineService {
  private baseUrl = '/telemedicine';

  async createSession(dto: CreateSessionDto): Promise<TelemedicineSession> {
    const response = await api.post(`${this.baseUrl}/sessions`, dto);
    return response.data;
  }

  async listSessions(params?: {
    page?: number;
    limit?: number;
    status?: string;
    patientId?: string;
    providerId?: string;
  }): Promise<{ data: TelemedicineSession[]; total: number; page: number; limit: number; totalPages: number }> {
    const search = new URLSearchParams();
    if (params?.page) search.append('page', params.page.toString());
    if (params?.limit) search.append('limit', params.limit.toString());
    if (params?.status) search.append('status', params.status);
    if (params?.patientId) search.append('patientId', params.patientId);
    if (params?.providerId) search.append('providerId', params.providerId);
    const response = await api.get(`${this.baseUrl}/sessions?${search.toString()}`);
    return response.data;
  }

  async getSession(id: string): Promise<TelemedicineSession> {
    const response = await api.get(`${this.baseUrl}/sessions/${id}`);
    return response.data;
  }

  async getToken(id: string, role: 'provider' | 'patient' | 'interpreter' = 'provider'): Promise<SessionToken> {
    const response = await api.get(`${this.baseUrl}/sessions/${id}/token?role=${role}`);
    return response.data;
  }

  async endSession(
    id: string,
    body: {
      transcript?: string;
      providerNotes?: string;
      generateEncounter?: boolean;
      generateSuperbill?: boolean;
    } = {},
  ): Promise<TelemedicineSession> {
    const response = await api.patch(`${this.baseUrl}/sessions/${id}/end`, body);
    return response.data;
  }

  async cancelSession(id: string, reason?: string): Promise<TelemedicineSession> {
    const response = await api.patch(`${this.baseUrl}/sessions/${id}/cancel`, { reason });
    return response.data;
  }

  async preVisitIntake(id: string, symptoms: string): Promise<{ triage: any; questions: string[] }> {
    const response = await api.post(`${this.baseUrl}/sessions/${id}/intake`, { symptoms });
    return response.data;
  }

  async postVisitCarePlan(id: string): Promise<{
    education: string[];
    followUp: string;
    medications: string[];
    warnings: string[];
  }> {
    const response = await api.get(`${this.baseUrl}/sessions/${id}/care-plan`);
    return response.data;
  }

  async getAnalytics(params?: {
    providerId?: string;
    patientId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{
    totalSessions: number;
    completedSessions: number;
    totalDurationMinutes: number;
    averageDurationMinutes: number;
    noShowCount: number;
    cancelledCount: number;
    sessionsByStatus: Record<string, number>;
    sessionsByDay: Record<string, number>;
  }> {
    const search = new URLSearchParams();
    if (params?.providerId) search.append('providerId', params.providerId);
    if (params?.patientId) search.append('patientId', params.patientId);
    if (params?.startDate) search.append('startDate', params.startDate);
    if (params?.endDate) search.append('endDate', params.endDate);
    const response = await api.get(`${this.baseUrl}/analytics?${search.toString()}`);
    return response.data;
  }
}

export const telemedicineService = new TelemedicineService();
