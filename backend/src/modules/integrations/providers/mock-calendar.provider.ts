// ─────────────────────────────────────────────────────────────────────────────
// Mock Calendar Provider — in-memory implementation for development/testing
// ─────────────────────────────────────────────────────────────────────────────

import { Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  CalendarEvent,
  CalendarEventResult,
  CalendarProvider,
  CalendarSyncResult,
} from './calendar-provider.interface';

export class MockCalendarProvider implements CalendarProvider {
  readonly name = 'mock-calendar';
  private readonly logger = new Logger(MockCalendarProvider.name);
  private readonly events = new Map<string, CalendarEvent>();

  async testConnection(
    _credentials: Record<string, unknown>,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.log('Mock calendar connection test — always succeeds');
    return { success: true, message: 'Mock calendar connected' };
  }

  getAuthUrl(_redirectUri: string, state: string): string {
    return `https://mock-oauth.example.com/auth?state=${encodeURIComponent(state)}`;
  }

  async exchangeCode(
    _code: string,
    _redirectUri: string,
  ): Promise<Record<string, unknown>> {
    return {
      access_token: 'mock-token',
      refresh_token: 'mock-refresh',
      expires_in: 3600,
    };
  }

  async upsertEvent(
    _credentials: Record<string, unknown>,
    event: CalendarEvent,
  ): Promise<CalendarEventResult> {
    const eventId = event.id ?? randomUUID();
    this.events.set(eventId, { ...event, id: eventId });
    this.logger.log(`Mock calendar: upserted event "${event.title}" (${eventId})`);
    return { eventId, status: 'confirmed' };
  }

  async deleteEvent(
    _credentials: Record<string, unknown>,
    eventId: string,
  ): Promise<void> {
    if (this.events.delete(eventId)) {
      this.logger.log(`Mock calendar: deleted event ${eventId}`);
    }
  }

  async listEvents(
    _credentials: Record<string, unknown>,
    startTime: Date,
    endTime: Date,
  ): Promise<CalendarEvent[]> {
    const results: CalendarEvent[] = [];
    for (const event of this.events.values()) {
      if (event.startTime >= startTime && event.endTime <= endTime) {
        results.push(event);
      }
    }
    return results;
  }

  async syncFromAppointments(
    credentials: Record<string, unknown>,
    appointments: CalendarEvent[],
  ): Promise<CalendarSyncResult> {
    let created = 0;
    let updated = 0;
    const errors: Array<{ appointmentId: string; error: string }> = [];

    for (const appt of appointments) {
      try {
        const existed = appt.id ? this.events.has(appt.id) : false;
        await this.upsertEvent(credentials, appt);
        if (existed) {
          updated++;
        } else {
          created++;
        }
      } catch (err) {
        errors.push({
          appointmentId: appt.appointmentId ?? appt.id ?? 'unknown',
          error: (err as Error).message,
        });
      }
    }

    this.logger.log(
      `Mock calendar sync complete: ${created} created, ${updated} updated, ${errors.length} errors`,
    );

    return { created, updated, deleted: 0, errors };
  }
}
