// ─────────────────────────────────────────────────────────────────────────────
// Google Meet Video Provider — implements VideoProvider via Google Calendar API
// Creates calendar events with Google Meet conference data to generate Meet links
// ─────────────────────────────────────────────────────────────────────────────

import { Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  CreateMeetingRequest,
  CreateMeetingResult,
  VideoProvider,
} from './video-provider.interface';

const GOOGLE_OAUTH_BASE = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_TOKENINFO_URL = 'https://www.googleapis.com/oauth2/v1/tokeninfo';
const GOOGLE_CALENDAR_EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar';

export class GoogleMeetProvider implements VideoProvider {
  readonly name = 'google-meet';
  private readonly logger = new Logger(GoogleMeetProvider.name);

  // ── Helpers ──────────────────────────────────────────────────────────────

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

  /** Convert CreateMeetingRequest to Google Calendar event with Meet conference data */
  private toCalendarEvent(request: CreateMeetingRequest): Record<string, unknown> {
    const endTime = new Date(request.startTime.getTime() + request.durationMinutes * 60_000);
    return {
      summary: request.topic,
      description: request.agenda,
      start: {
        dateTime: request.startTime.toISOString(),
        timeZone: request.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: request.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      conferenceData: {
        createRequest: {
          requestId: randomUUID(),
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    };
  }

  /** Map Google Calendar event to our CreateMeetingResult */
  private fromCalendarEvent(data: Record<string, unknown>): CreateMeetingResult {
    const conferenceData = data['conferenceData'] as Record<string, unknown> | undefined;
    const entryPoints = conferenceData?.['entryPoints'] as Array<Record<string, unknown>> | undefined;
    const joinUrl =
      (entryPoints?.find((e) => e['entryPointType'] === 'video')?.['uri'] as string) ||
      (conferenceData?.['entryPoints'] as Array<Record<string, unknown>>)?.[0]?.['uri'] as string ||
      '';

    return {
      meetingId: (data['id'] as string) || '',
      joinUrl,
      providerMeetingId: (data['id'] as string) || undefined,
    };
  }

  // ── VideoProvider implementation ─────────────────────────────────────────

  getAuthUrl(redirectUri: string, state: string): string {
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

  /** Temporary storage for OAuth credentials needed by exchangeCode */
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
      return { success: true, message: `Google Meet connected (expires in ${data['expires_in'] ?? 'N/A'}s)` };
    } catch (err) {
      this.logger.error('testConnection failed', (err as Error).stack);
      return { success: false, message: (err as Error).message };
    }
  }

  async createMeeting(
    credentials: Record<string, unknown>,
    request: CreateMeetingRequest,
  ): Promise<CreateMeetingResult> {
    try {
      // conferenceDataVersion=1 is required to create Meet links
      const url = `${GOOGLE_CALENDAR_EVENTS_URL}?conferenceDataVersion=1`;
      const res = await this.fetchWithRefresh(credentials, url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.toCalendarEvent(request)),
      });

      if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(`Create meeting failed: ${res.status} ${errorBody}`);
      }

      const data = await res.json();
      this.logger.log(`Google Meet created: "${request.topic}" (id=${data['id']})`);
      return this.fromCalendarEvent(data);
    } catch (err) {
      this.logger.error('createMeeting failed', (err as Error).stack);
      throw err;
    }
  }

  async getMeeting(
    credentials: Record<string, unknown>,
    meetingId: string,
  ): Promise<CreateMeetingResult> {
    try {
      const url = `${GOOGLE_CALENDAR_EVENTS_URL}/${encodeURIComponent(meetingId)}`;
      const res = await this.fetchWithRefresh(credentials, url, { method: 'GET' });

      if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(`Get meeting failed: ${res.status} ${errorBody}`);
      }

      const data = await res.json();
      return this.fromCalendarEvent(data);
    } catch (err) {
      this.logger.error('getMeeting failed', (err as Error).stack);
      throw err;
    }
  }

  async updateMeeting(
    credentials: Record<string, unknown>,
    meetingId: string,
    request: Partial<CreateMeetingRequest>,
  ): Promise<CreateMeetingResult> {
    try {
      const url = `${GOOGLE_CALENDAR_EVENTS_URL}/${encodeURIComponent(meetingId)}?conferenceDataVersion=1`;
      const body: Record<string, unknown> = {};
      if (request.topic !== undefined) body['summary'] = request.topic;
      if (request.agenda !== undefined) body['description'] = request.agenda;
      if (request.startTime !== undefined) {
        body['start'] = {
          dateTime: request.startTime.toISOString(),
          timeZone: request.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        };
      }
      if (request.durationMinutes !== undefined) {
        const baseTime = request.startTime ?? new Date();
        body['end'] = {
          dateTime: new Date(baseTime.getTime() + request.durationMinutes * 60_000).toISOString(),
          timeZone: request.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        };
      }

      const res = await this.fetchWithRefresh(credentials, url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(`Update meeting failed: ${res.status} ${errorBody}`);
      }

      const data = await res.json();
      return this.fromCalendarEvent(data);
    } catch (err) {
      this.logger.error('updateMeeting failed', (err as Error).stack);
      throw err;
    }
  }

  async deleteMeeting(
    credentials: Record<string, unknown>,
    meetingId: string,
  ): Promise<void> {
    try {
      const url = `${GOOGLE_CALENDAR_EVENTS_URL}/${encodeURIComponent(meetingId)}`;
      const res = await this.fetchWithRefresh(credentials, url, { method: 'DELETE' });

      if (!res.ok && res.status !== 404) {
        const errorBody = await res.text();
        throw new Error(`Delete meeting failed: ${res.status} ${errorBody}`);
      }

      this.logger.log(`Google Meet deleted: ${meetingId}`);
    } catch (err) {
      this.logger.error('deleteMeeting failed', (err as Error).stack);
      throw err;
    }
  }
}
