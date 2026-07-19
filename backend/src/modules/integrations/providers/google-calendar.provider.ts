// ─────────────────────────────────────────────────────────────────────────────
// Google Calendar Provider — implements CalendarProvider via Google Calendar API v3
// ─────────────────────────────────────────────────────────────────────────────

import { Logger } from '@nestjs/common';
import {
  CalendarEvent,
  CalendarEventResult,
  CalendarProvider,
  CalendarSyncResult,
} from './calendar-provider.interface';

const GOOGLE_OAUTH_BASE = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_TOKENINFO_URL = 'https://www.googleapis.com/oauth2/v1/tokeninfo';
const GOOGLE_CALENDAR_BASE = 'https://www.googleapis.com/calendar/v3/calendars';
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar';

export class GoogleCalendarProvider implements CalendarProvider {
  readonly name = 'google-calendar';
  private readonly logger = new Logger(GoogleCalendarProvider.name);

  // ── Helpers ──────────────────────────────────────────────────────────────

  private getCalendarId(credentials: Record<string, unknown>): string {
    return (credentials['calendarId'] as string) || 'primary';
  }

  private getAccessToken(credentials: Record<string, unknown>): string {
    const token = credentials['accessToken'] as string;
    if (!token) {
      throw new Error('Missing accessToken in credentials');
    }
    return token;
  }

  private getClientId(credentials: Record<string, unknown>): string {
    const id = credentials['clientId'] as string;
    if (!id) throw new Error('Missing clientId in credentials');
    return id;
  }

  private getClientSecret(credentials: Record<string, unknown>): string {
    const secret = credentials['clientSecret'] as string;
    if (!secret) throw new Error('Missing clientSecret in credentials');
    return secret;
  }

  private getRefreshTokenValue(credentials: Record<string, unknown>): string {
    return credentials['refreshToken'] as string;
  }

  /** Convert Date to RFC3339 timestamp required by Google Calendar API */
  private toRfc3339(date: Date): string {
    return date.toISOString();
  }

  /** Convert our CalendarEvent to Google Calendar event body */
  private toGoogleEvent(event: CalendarEvent): Record<string, unknown> {
    return {
      summary: event.title,
      description: event.description,
      location: event.location,
      start: {
        dateTime: this.toRfc3339(event.startTime),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      end: {
        dateTime: this.toRfc3339(event.endTime),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      attendees: event.attendees?.map((a) => ({
        email: a.email,
        displayName: a.name,
        optional: a.optional,
      })),
      reminders: event.reminders
        ? {
            useDefault: false,
            overrides: event.reminders.map((r) => ({
              method: r.method,
              minutes: r.minutesBefore,
            })),
          }
        : undefined,
      extendedProperties: event.metadata
        ? { private: event.metadata as Record<string, string> }
        : undefined,
    };
  }

  /** Convert Google Calendar event to our CalendarEvent */
  private fromGoogleEvent(googleEvent: Record<string, unknown>): CalendarEvent {
    const start = googleEvent['start'] as Record<string, unknown> | undefined;
    const end = googleEvent['end'] as Record<string, unknown> | undefined;
    return {
      id: googleEvent['id'] as string,
      title: (googleEvent['summary'] as string) || '',
      description: googleEvent['description'] as string,
      startTime: new Date((start?.['dateTime'] as string) || (start?.['date'] as string) || Date.now()),
      endTime: new Date((end?.['dateTime'] as string) || (end?.['date'] as string) || Date.now()),
      location: googleEvent['location'] as string,
      attendees: ((googleEvent['attendees'] as Array<Record<string, unknown>>) || []).map((a) => ({
        email: a['email'] as string,
        name: a['displayName'] as string,
        optional: a['optional'] as boolean,
      })),
    };
  }

  /** Execute a fetch, auto-refreshing the token on 401 */
  private async fetchWithRefresh(
    credentials: Record<string, unknown>,
    url: string,
    init: RequestInit,
  ): Promise<Response> {
    const token = this.getAccessToken(credentials);
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${token}`);
    const response = await fetch(url, { ...init, headers });

    if (response.status === 401 && credentials['refreshToken']) {
      this.logger.warn('Access token expired, attempting refresh...');
      try {
        const refreshed = await this.refreshToken(credentials);
        const newToken = refreshed['access_token'] as string;
        headers.set('Authorization', `Bearer ${newToken}`);
        return fetch(url, { ...init, headers });
      } catch (err) {
        this.logger.error('Token refresh failed', (err as Error).stack);
        throw new Error('Token refresh failed — re-authentication required');
      }
    }

    return response;
  }

  // ── CalendarProvider implementation ──────────────────────────────────────

  async testConnection(
    credentials: Record<string, unknown>,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const token = this.getAccessToken(credentials);
      const res = await fetch(`${GOOGLE_TOKENINFO_URL}?access_token=${encodeURIComponent(token)}`);
      if (!res.ok) {
        const body = await res.text();
        return { success: false, message: `Token invalid: ${body}` };
      }
      const data = await res.json();
      if (data['error']) {
        return { success: false, message: `Token invalid: ${data['error']}` };
      }
      return { success: true, message: `Google Calendar connected (expires in ${data['expires_in'] ?? 'N/A'}s)` };
    } catch (err) {
      this.logger.error('testConnection failed', (err as Error).stack);
      return { success: false, message: (err as Error).message };
    }
  }

  getAuthUrl(redirectUri: string, state: string): string {
    // clientId is needed — but getAuthUrl doesn't receive credentials per the interface.
    // The caller must build the URL with clientId; we return a template that the service
    // fills in. In practice the integration service passes clientId via state or the
    // caller appends it. Here we build what we can.
    const params = new URLSearchParams({
      client_id: '{clientId}',
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: CALENDAR_SCOPE,
      access_type: 'offline',
      prompt: 'consent',
      state,
    });
    return `${GOOGLE_OAUTH_BASE}?${params.toString()}`;
  }

  async exchangeCode(
    code: string,
    redirectUri: string,
  ): Promise<Record<string, unknown>> {
    // exchangeCode per interface doesn't receive credentials, but Google requires
    // clientId/clientSecret. The integration service should pass these via the code
    // or store them. We attempt to read from a module-level holder if set.
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: this.pendingClientId ?? '',
      client_secret: this.pendingClientSecret ?? '',
    });

    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!res.ok) {
      const errorBody = await res.text();
      this.logger.error(`exchangeCode failed: ${res.status} ${errorBody}`);
      throw new Error(`Failed to exchange code: ${errorBody}`);
    }

    return res.json();
  }

  /** Temporary storage for clientId/clientSecret needed by exchangeCode */
  private pendingClientId?: string;
  private pendingClientSecret?: string;

  /** Set credentials for OAuth code exchange (called by integration service) */
  setOAuthCredentials(clientId: string, clientSecret: string): void {
    this.pendingClientId = clientId;
    this.pendingClientSecret = clientSecret;
  }

  async refreshToken(
    credentials: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const refreshTokenValue = this.getRefreshTokenValue(credentials);
    if (!refreshTokenValue) {
      throw new Error('Missing refreshToken in credentials');
    }

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshTokenValue,
      client_id: this.getClientId(credentials),
      client_secret: this.getClientSecret(credentials),
    });

    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!res.ok) {
      const errorBody = await res.text();
      this.logger.error(`refreshToken failed: ${res.status} ${errorBody}`);
      throw new Error(`Failed to refresh token: ${errorBody}`);
    }

    return res.json();
  }

  async upsertEvent(
    credentials: Record<string, unknown>,
    event: CalendarEvent,
  ): Promise<CalendarEventResult> {
    const calendarId = this.getCalendarId(credentials);
    const googleEvent = this.toGoogleEvent(event);

    try {
      // If event has an id, try to PATCH it
      if (event.id) {
        const patchUrl = `${GOOGLE_CALENDAR_BASE}/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(event.id)}`;
        const res = await this.fetchWithRefresh(credentials, patchUrl, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(googleEvent),
        });

        if (res.ok) {
          const data = await res.json();
          return {
            eventId: data['id'] as string,
            htmlLink: data['htmlLink'] as string,
            hangoutLink: data['hangoutLink'] as string,
            status: (data['status'] as 'confirmed' | 'tentative' | 'cancelled') || 'confirmed',
          };
        }

        // If event doesn't exist (404), fall through to create
        if (res.status !== 404) {
          const errorBody = await res.text();
          throw new Error(`PATCH event failed: ${res.status} ${errorBody}`);
        }
      }

      // Create new event
      const createUrl = `${GOOGLE_CALENDAR_BASE}/${encodeURIComponent(calendarId)}/events`;
      const res = await this.fetchWithRefresh(credentials, createUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(googleEvent),
      });

      if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(`Create event failed: ${res.status} ${errorBody}`);
      }

      const data = await res.json();
      return {
        eventId: data['id'] as string,
        htmlLink: data['htmlLink'] as string,
        hangoutLink: data['hangoutLink'] as string,
        status: (data['status'] as 'confirmed' | 'tentative' | 'cancelled') || 'confirmed',
      };
    } catch (err) {
      this.logger.error(`upsertEvent failed for "${event.title}"`, (err as Error).stack);
      throw err;
    }
  }

  async deleteEvent(
    credentials: Record<string, unknown>,
    eventId: string,
  ): Promise<void> {
    const calendarId = this.getCalendarId(credentials);
    const url = `${GOOGLE_CALENDAR_BASE}/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;

    try {
      const res = await this.fetchWithRefresh(credentials, url, { method: 'DELETE' });
      if (!res.ok && res.status !== 404) {
        const errorBody = await res.text();
        throw new Error(`Delete event failed: ${res.status} ${errorBody}`);
      }
    } catch (err) {
      this.logger.error(`deleteEvent failed for ${eventId}`, (err as Error).stack);
      throw err;
    }
  }

  async listEvents(
    credentials: Record<string, unknown>,
    startTime: Date,
    endTime: Date,
  ): Promise<CalendarEvent[]> {
    const calendarId = this.getCalendarId(credentials);
    const params = new URLSearchParams({
      timeMin: this.toRfc3339(startTime),
      timeMax: this.toRfc3339(endTime),
      singleEvents: 'true',
      orderBy: 'startTime',
    });
    const url = `${GOOGLE_CALENDAR_BASE}/${encodeURIComponent(calendarId)}/events?${params.toString()}`;

    try {
      const res = await this.fetchWithRefresh(credentials, url, { method: 'GET' });
      if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(`List events failed: ${res.status} ${errorBody}`);
      }

      const data = await res.json();
      const items = (data['items'] as Array<Record<string, unknown>>) || [];
      return items.map((item) => this.fromGoogleEvent(item));
    } catch (err) {
      this.logger.error('listEvents failed', (err as Error).stack);
      throw err;
    }
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
        const existed = !!appt.id;
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
      `Google Calendar sync: ${created} created, ${updated} updated, ${errors.length} errors`,
    );

    return { created, updated, deleted: 0, errors };
  }
}
