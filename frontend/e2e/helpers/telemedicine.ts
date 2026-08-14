import { request, type APIRequestContext } from '@playwright/test';
import type { E2EState } from '../global.setup';

/**
 * API helpers for the telemedicine module. These let E2E tests drive the
 * session lifecycle (create / start / end / cancel) and read analytics
 * directly against the backend, so the dashboard assertions have a reliable
 * source of truth instead of depending on flaky UI interactions.
 */

const BASE = 'http://localhost:4000';

export interface TelemedicineSessionDto {
  id: string;
  tenantId: string;
  appointmentId: string | null;
  patientId: string;
  providerId: string;
  roomId: string;
  status: string;
  participants: Array<{ userId: string; role: string; name: string; joinedAt?: string; leftAt?: string }>;
  startedAt: string | null;
  endedAt: string | null;
  durationMinutes: number | null;
  recordingConsent: boolean;
  recordingStatus: string;
  transcript: string | null;
  soapNote: { subjective?: string; objective?: string; assessment?: string; plan?: string };
  encounterId: string | null;
  superbillId: string | null;
  providerNotes: string | null;
  createdAt: string;
}

export interface TelemedicineAnalyticsDto {
  totalSessions: number;
  completedSessions: number;
  totalDurationMinutes: number;
  averageDurationMinutes: number;
  noShowCount: number;
  cancelledCount: number;
  sessionsByStatus: Record<string, number>;
  sessionsByDay: Record<string, number>;
}

export interface ListSessionsResponse {
  data: TelemedicineSessionDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

function authHeaders(state: E2EState): Record<string, string> {
  return { Authorization: `Bearer ${state.token}` };
}

async function withContext<T>(fn: (ctx: APIRequestContext) => Promise<T>): Promise<T> {
  const context = await request.newContext({ baseURL: BASE });
  try {
    return await fn(context);
  } finally {
    await context.dispose();
  }
}

function assertOk(response: { ok(): boolean; status(): number; text(): Promise<string> }, label: string) {
  if (!response.ok()) {
    throw new Error(`${label} failed (${response.status()})`);
  }
}

/**
 * Find or create a telemedicine session for an existing appointment.
 * Mirrors `telemedicineService.findOrCreateForAppointment`.
 */
export async function findOrCreateSessionForAppointment(
  state: E2EState,
  appointmentId: string,
): Promise<TelemedicineSessionDto> {
  return withContext(async (ctx) => {
    const response = await ctx.post(`/api/v1/telemedicine/sessions/for-appointment/${appointmentId}`, {
      headers: authHeaders(state),
    });
    assertOk(response, 'findOrCreateSessionForAppointment');
    return response.json();
  });
}

/**
 * Create a standalone telemedicine session (not tied to an appointment).
 */
export async function createSession(
  state: E2EState,
  body: { patientId: string; providerId: string; appointmentId?: string; enableRecording?: boolean; recordingConsent?: boolean },
): Promise<TelemedicineSessionDto> {
  return withContext(async (ctx) => {
    const response = await ctx.post('/api/v1/telemedicine/sessions', {
      headers: authHeaders(state),
      data: body,
    });
    assertOk(response, 'createSession');
    return response.json();
  });
}

/**
 * End a telemedicine session. Optionally generate an encounter/superbill.
 */
export async function endSession(
  state: E2EState,
  sessionId: string,
  options: { transcript?: string; providerNotes?: string; generateEncounter?: boolean; generateSuperbill?: boolean } = {},
): Promise<TelemedicineSessionDto> {
  return withContext(async (ctx) => {
    const response = await ctx.patch(`/api/v1/telemedicine/sessions/${sessionId}/end`, {
      headers: authHeaders(state),
      data: options,
    });
    assertOk(response, 'endSession');
    return response.json();
  });
}

/**
 * Cancel a telemedicine session.
 */
export async function cancelSession(
  state: E2EState,
  sessionId: string,
  reason?: string,
): Promise<TelemedicineSessionDto> {
  return withContext(async (ctx) => {
    const response = await ctx.patch(`/api/v1/telemedicine/sessions/${sessionId}/cancel`, {
      headers: authHeaders(state),
      data: { reason },
    });
    assertOk(response, 'cancelSession');
    return response.json();
  });
}

/**
 * List telemedicine sessions with optional filters.
 */
export async function listSessions(
  state: E2EState,
  params: { page?: number; limit?: number; status?: string; patientId?: string; providerId?: string } = {},
): Promise<ListSessionsResponse> {
  const search = new URLSearchParams();
  if (params.page) search.append('page', String(params.page));
  if (params.limit) search.append('limit', String(params.limit));
  if (params.status) search.append('status', params.status);
  if (params.patientId) search.append('patientId', params.patientId);
  if (params.providerId) search.append('providerId', params.providerId);

  return withContext(async (ctx) => {
    const response = await ctx.get(`/api/v1/telemedicine/sessions?${search.toString()}`, {
      headers: authHeaders(state),
    });
    assertOk(response, 'listSessions');
    return response.json();
  });
}

/**
 * Get a single telemedicine session by id.
 */
export async function getSession(state: E2EState, sessionId: string): Promise<TelemedicineSessionDto> {
  return withContext(async (ctx) => {
    const response = await ctx.get(`/api/v1/telemedicine/sessions/${sessionId}`, {
      headers: authHeaders(state),
    });
    assertOk(response, 'getSession');
    return response.json();
  });
}

/**
 * Get telemedicine analytics aggregate.
 */
export async function getAnalytics(
  state: E2EState,
  params: { providerId?: string; patientId?: string; startDate?: string; endDate?: string } = {},
): Promise<TelemedicineAnalyticsDto> {
  const search = new URLSearchParams();
  if (params.providerId) search.append('providerId', params.providerId);
  if (params.patientId) search.append('patientId', params.patientId);
  if (params.startDate) search.append('startDate', params.startDate);
  if (params.endDate) search.append('endDate', params.endDate);

  return withContext(async (ctx) => {
    const response = await ctx.get(`/api/v1/telemedicine/analytics?${search.toString()}`, {
      headers: authHeaders(state),
    });
    assertOk(response, 'getAnalytics');
    return response.json();
  });
}
