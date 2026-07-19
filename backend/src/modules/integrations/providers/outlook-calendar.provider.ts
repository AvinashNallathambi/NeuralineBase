// ─────────────────────────────────────────────────────────────────────────────
// Outlook / Microsoft Graph Calendar Provider
// ─────────────────────────────────────────────────────────────────────────────

import { Logger } from '@nestjs/common';
import {
  CalendarEvent,
  CalendarEventResult,
  CalendarProvider,
  CalendarSyncResult,
} from './calendar-provider.interface';

const MS_AUTH_BASE = 'https://login.microsoftonline.com';
const MS_GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const CALENDAR_SCOPES = 'Calendars.ReadWrite offline_access';

export class OutlookCalendarProvider implements CalendarProvider {
  readonly name = 'outlook-calendar';
  private readonly logger = new Logger(OutlookCalendarProvider.name);

  // ── Helpers ──────────────────────────────────────────────────────────────

  private getTenantId(credentials: Record<string, unknown>): string {
    return (credentials['tenantId'] as string) || 'common';
  }

  private getAccessToken(credentials: Record<string, unknown>): string {
    const token = credentials['accessToken'] as string;
    if (!token) throw new Error('Missing accessToken in credentials');
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

  private getTokenUrl(credentials: Record<string, unknown>): string {
    return `${MS_AUTH_BASE}/${this.getTenantId(credentials)}/oauth2/v2.0/token`;
  }

  /** Convert our CalendarEvent to Microsoft Graph event body */
  private toGraphEvent(event: CalendarEvent): Record<string, unknown> {
    return {
      subject: event.title,
      body: event.description
        ? { contentType: 'text', content: event.description }
        : undefined,
      location: event.location
        ? { displayName: event.location }
        : undefined,
      start: {
        dateTime: event.startTime.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      end: {
        dateTime: event.endTime.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      attendees: event.attendees?.map((a) => ({
        emailAddress: { address: a.email, name: a.name },
        type: a.optional ? 'optional' : 'required',
      })),
    };
  }

  /** Convert Microsoft Graph event to our CalendarEvent */
  private fromGraphEvent(graphEvent: Record<string, unknown>): CalendarEvent {
    const start = graphEvent['start'] as Record<string, unknown> | undefined;
    const end = graphEvent['end'] as Record<string, unknown> | undefined;
    return {
      id: graphEvent['id'] as string,
      title: (graphEvent['subject'] as string) || '',
      description: (graphEvent['body'] as Record<string, unknown>)?.['content'] as string,
      startTime: new Date((start?.['dateTime'] as string) || Date.now()),
      endTime: new Date((end?.['dateTime'] as string) || Date.now()),
      location: (graphEvent['location'] as Record<string, unknown>)?.['displayName'] as string,
      attendees: ((graphEvent['attendees'] as Array<Record<string, unknown>>) || []).map((a) => {
        const email = a['emailAddress'] as Record<string, unknown>;
        return {
          email: email?.['address'] as string,
          name: email?.['name'] as string,
          optional: a['type'] === 'optional',
        };
      }),
    };
  }

  /** Execute a fetch with Bearer auth, auto-refreshing on 401 */
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
      const res = await fetch(`${MS_GRAPH_BASE}/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.text();
        return { success: false, message: `Token invalid: ${body}` };
      }
      const data = await res.json();
      return {
        success: true,
        message: `Outlook Calendar connected as ${data['userPrincipalName'] ?? data['displayName'] ?? 'user'}`,
      };
    } catch (err) {
      this.logger.error('testConnection failed', (err as Error).stack);
      return { success: false, message: (err as Error).message };
    }
  }

  getAuthUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      client_id: '{clientId}',
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: CALENDAR_SCOPES,
      state,
    });
    return `${MS_AUTH_BASE}/{tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
  }

  async exchangeCode(
    code: string,
    redirectUri: string,
  ): Promise<Record<string, unknown>> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: this.pendingClientId ?? '',
      client_secret: this.pendingClientSecret ?? '',
      scope: CALENDAR_SCOPES,
    });

    const tokenUrl = `${MS_AUTH_BASE}/${this.pendingTenantId ?? 'common'}/oauth2/v2.0/token`;
    const res = await fetch(tokenUrl, {
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

  /** Temporary storage for OAuth credentials needed by exchangeCode */
  private pendingClientId?: string;
  private pendingClientSecret?: string;
  private pendingTenantId?: string;

  /** Set credentials for OAuth code exchange (called by integration service) */
  setOAuthCredentials(clientId: string, clientSecret: string, tenantId?: string): void {
    this.pendingClientId = clientId;
    this.pendingClientSecret = clientSecret;
    this.pendingTenantId = tenantId;
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
      scope: CALENDAR_SCOPES,
    });

    const res = await fetch(this.getTokenUrl(credentials), {
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
    const graphEvent = this.toGraphEvent(event);
    const eventsUrl = `${MS_GRAPH_BASE}/me/calendar/events`;

    try {
      // If event has an id, try to PATCH it
      if (event.id) {
        const patchUrl = `${eventsUrl}/${encodeURIComponent(event.id)}`;
        const res = await this.fetchWithRefresh(credentials, patchUrl, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(graphEvent),
        });

        if (res.ok) {
          const data = await res.json();
          return {
            eventId: data['id'] as string,
            htmlLink: (data['onlineMeeting'] as Record<string, unknown>)?.['joinUrl'] as string,
            status: 'confirmed',
          };
        }

        if (res.status !== 404) {
          const errorBody = await res.text();
          throw new Error(`PATCH event failed: ${res.status} ${errorBody}`);
        }
      }

      // Create new event
      const res = await this.fetchWithRefresh(credentials, eventsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(graphEvent),
      });

      if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(`Create event failed: ${res.status} ${errorBody}`);
      }

      const data = await res.json();
      return {
        eventId: data['id'] as string,
        htmlLink: (data['onlineMeeting'] as Record<string, unknown>)?.['joinUrl'] as string,
        status: 'confirmed',
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
    const url = `${MS_GRAPH_BASE}/me/calendar/events/${encodeURIComponent(eventId)}`;

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
    const startStr = startTime.toISOString();
    const endStr = endTime.toISOString();
    const filter = `start/dateTime ge '${startStr}' and start/dateTime le '${endStr}'`;
    const params = new URLSearchParams({
      $filter: filter,
      $orderby: 'start/dateTime',
    });
    const url = `${MS_GRAPH_BASE}/me/calendar/events?${params.toString()}`;

    try {
      const res = await this.fetchWithRefresh(credentials, url, { method: 'GET' });
      if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(`List events failed: ${res.status} ${errorBody}`);
      }

      const data = await res.json();
      const items = (data['value'] as Array<Record<string, unknown>>) || [];
      return items.map((item) => this.fromGraphEvent(item));
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
      `Outlook Calendar sync: ${created} created, ${updated} updated, ${errors.length} errors`,
    );

    return { created, updated, deleted: 0, errors };
  }
}
