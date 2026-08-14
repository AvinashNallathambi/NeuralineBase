import { request, type APIRequestContext } from '@playwright/test';
import type { E2EState } from '../global.setup';

/**
 * API helpers for creating and updating appointments via the backend.
 * These are used by E2E tests to set up test data reliably without going
 * through the flaky UI form (date/time pickers are hard to drive from
 * Playwright).
 */

export interface CreateAppointmentParams {
  patientId: string;
  providerId: string;
  appointmentType: string;
  startTime: string; // ISO string
  endTime: string;   // ISO string
  isTelehealth?: boolean;
  reason?: string;
}

export async function createAppointmentViaApi(
  state: E2EState,
  params: CreateAppointmentParams,
): Promise<{ id: string; [key: string]: unknown }> {
  const context = await request.newContext({ baseURL: 'http://localhost:4000' });
  try {
    const response = await context.post('/api/v1/appointments', {
      headers: { Authorization: `Bearer ${state.token}` },
      data: {
        patientId: params.patientId,
        providerId: params.providerId,
        appointmentType: params.appointmentType,
        startTime: params.startTime,
        endTime: params.endTime,
        isTelehealth: params.isTelehealth ?? false,
        reason: params.reason ?? 'E2E test appointment',
      },
    });

    if (!response.ok()) {
      const body = await response.text();
      throw new Error(`Create appointment failed (${response.status()}): ${body}`);
    }

    return response.json();
  } finally {
    await context.dispose();
  }
}

export async function getAllUsersViaApi(state: E2EState): Promise<Array<{ id: string; firstName: string; lastName: string; role: string }>> {
  const context = await request.newContext({ baseURL: 'http://localhost:4000' });
  try {
    const response = await context.get('/api/v1/users', {
      headers: { Authorization: `Bearer ${state.token}` },
    });

    if (!response.ok()) {
      throw new Error(`Get users failed (${response.status()})`);
    }

    return response.json();
  } finally {
    await context.dispose();
  }
}

/**
 * Find a provider (doctor) that is NOT the default test user.
 * Returns the first doctor or super_admin that isn't Sarah Chen.
 */
export async function findSecondProviderViaApi(state: E2EState): Promise<{ id: string; name: string }> {
  const users = await getAllUsersViaApi(state);
  const sarahId = state.user.id;

  const other = users.find(
    (u) => u.id !== sarahId && (u.role === 'doctor' || u.role === 'super_admin'),
  );

  if (!other) {
    throw new Error('No second provider found for E2E test');
  }

  return { id: other.id, name: `${other.firstName} ${other.lastName}` };
}

// ── Provider Availability API helpers ─────────────────────────────────────────

export interface CreateAvailabilityParams {
  providerId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isAvailable?: boolean;
  slotDuration?: number;
  appointmentTypes?: string[];
  locationId?: string;
  maxAppointments?: number;
  bufferMinutes?: number;
  notes?: string;
  isRecurring?: boolean;
  effectiveDate?: string;
  expiryDate?: string;
}

export async function createAvailabilityViaApi(
  state: E2EState,
  params: CreateAvailabilityParams,
): Promise<{ id: string; [key: string]: unknown }> {
  const context = await request.newContext({ baseURL: 'http://localhost:4000' });
  try {
    const response = await context.post('/api/v1/appointments/availability', {
      headers: { Authorization: `Bearer ${state.token}` },
      data: params,
    });

    if (!response.ok()) {
      const body = await response.text();
      throw new Error(`Create availability failed (${response.status()}): ${body}`);
    }

    return response.json();
  } finally {
    await context.dispose();
  }
}

export async function deleteAvailabilityViaApi(state: E2EState, id: string): Promise<void> {
  const context = await request.newContext({ baseURL: 'http://localhost:4000' });
  try {
    const response = await context.delete(`/api/v1/appointments/availability/${id}`, {
      headers: { Authorization: `Bearer ${state.token}` },
    });

    if (!response.ok()) {
      const body = await response.text();
      throw new Error(`Delete availability failed (${response.status()}): ${body}`);
    }
  } finally {
    await context.dispose();
  }
}

export async function getAvailabilityByProviderViaApi(
  state: E2EState,
  providerId: string,
): Promise<Array<{ id: string; [key: string]: unknown }>> {
  const context = await request.newContext({ baseURL: 'http://localhost:4000' });
  try {
    const response = await context.get(`/api/v1/appointments/availability/${providerId}`, {
      headers: { Authorization: `Bearer ${state.token}` },
    });

    if (!response.ok()) {
      const body = await response.text();
      throw new Error(`Get availability failed (${response.status()}): ${body}`);
    }

    return response.json();
  } finally {
    await context.dispose();
  }
}

export interface CreateOverrideParams {
  providerId: string;
  overrideDate: string;
  overrideType: string;
  isAvailable?: boolean;
  startTime?: string;
  endTime?: string;
  reason?: string;
  isRecurring?: boolean;
}

export async function createOverrideViaApi(
  state: E2EState,
  params: CreateOverrideParams,
): Promise<{ id: string; [key: string]: unknown }> {
  const context = await request.newContext({ baseURL: 'http://localhost:4000' });
  try {
    const response = await context.post('/api/v1/appointments/availability-overrides', {
      headers: { Authorization: `Bearer ${state.token}` },
      data: params,
    });

    if (!response.ok()) {
      const body = await response.text();
      throw new Error(`Create override failed (${response.status()}): ${body}`);
    }

    return response.json();
  } finally {
    await context.dispose();
  }
}

export async function deleteOverrideViaApi(state: E2EState, id: string): Promise<void> {
  const context = await request.newContext({ baseURL: 'http://localhost:4000' });
  try {
    const response = await context.delete(`/api/v1/appointments/availability-overrides/${id}`, {
      headers: { Authorization: `Bearer ${state.token}` },
    });

    if (!response.ok()) {
      const body = await response.text();
      throw new Error(`Delete override failed (${response.status()}): ${body}`);
    }
  } finally {
    await context.dispose();
  }
}

export async function getAllOverridesViaApi(
  state: E2EState,
): Promise<Array<{ id: string; providerId: string; [key: string]: unknown }>> {
  const context = await request.newContext({ baseURL: 'http://localhost:4000' });
  try {
    const response = await context.get('/api/v1/appointments/availability-overrides', {
      headers: { Authorization: `Bearer ${state.token}` },
    });

    if (!response.ok()) {
      const body = await response.text();
      throw new Error(`Get overrides failed (${response.status()}): ${body}`);
    }

    return response.json();
  } finally {
    await context.dispose();
  }
}
