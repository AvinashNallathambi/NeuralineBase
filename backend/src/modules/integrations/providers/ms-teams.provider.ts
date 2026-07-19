// ─────────────────────────────────────────────────────────────────────────────
// Microsoft Teams Video Provider — implements VideoProvider via Microsoft Graph
// ─────────────────────────────────────────────────────────────────────────────

import { Logger } from '@nestjs/common';
import {
  CreateMeetingRequest,
  CreateMeetingResult,
  VideoProvider,
} from './video-provider.interface';

const MS_AUTH_BASE = 'https://login.microsoftonline.com';
const MS_GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const TEAMS_SCOPES = 'OnlineMeetings.ReadWrite offline_access';

export class MsTeamsProvider implements VideoProvider {
  readonly name = 'ms-teams';
  private readonly logger = new Logger(MsTeamsProvider.name);

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

  /** Convert CreateMeetingRequest to Graph onlineMeeting body */
  private toGraphMeeting(request: CreateMeetingRequest): Record<string, unknown> {
    const endTime = new Date(request.startTime.getTime() + request.durationMinutes * 60_000);
    return {
      subject: request.topic,
      startDateTime: request.startTime.toISOString(),
      endDateTime: endTime.toISOString(),
      ...(request.agenda ? { body: { content: request.agenda } } : {}),
    };
  }

  /** Map Graph onlineMeeting to our CreateMeetingResult */
  private fromGraphMeeting(data: Record<string, unknown>): CreateMeetingResult {
    return {
      meetingId: (data['id'] as string) || '',
      joinUrl: (data['joinUrl'] as string) || '',
      providerMeetingId: (data['id'] as string) || undefined,
    };
  }

  // ── VideoProvider implementation ─────────────────────────────────────────

  getAuthUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      client_id: '{clientId}',
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: TEAMS_SCOPES,
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
      scope: TEAMS_SCOPES,
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
      scope: TEAMS_SCOPES,
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
        message: `MS Teams connected as ${data['userPrincipalName'] ?? data['displayName'] ?? 'user'}`,
      };
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
      const url = `${MS_GRAPH_BASE}/me/onlineMeetings`;
      const res = await this.fetchWithRefresh(credentials, url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.toGraphMeeting(request)),
      });

      if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(`Create meeting failed: ${res.status} ${errorBody}`);
      }

      const data = await res.json();
      this.logger.log(`MS Teams meeting created: "${request.topic}" (id=${data['id']})`);
      return this.fromGraphMeeting(data);
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
      const url = `${MS_GRAPH_BASE}/me/onlineMeetings/${encodeURIComponent(meetingId)}`;
      const res = await this.fetchWithRefresh(credentials, url, { method: 'GET' });

      if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(`Get meeting failed: ${res.status} ${errorBody}`);
      }

      const data = await res.json();
      return this.fromGraphMeeting(data);
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
      const url = `${MS_GRAPH_BASE}/me/onlineMeetings/${encodeURIComponent(meetingId)}`;
      const body: Record<string, unknown> = {};
      if (request.topic !== undefined) body['subject'] = request.topic;
      if (request.startTime !== undefined) body['startDateTime'] = request.startTime.toISOString();
      if (request.durationMinutes !== undefined) {
        const endTime = new Date(request.startTime?.getTime() ?? Date.now() + request.durationMinutes * 60_000);
        body['endDateTime'] = endTime.toISOString();
      }
      if (request.agenda !== undefined) body['body'] = { content: request.agenda };

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
      return this.fromGraphMeeting(data);
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
      const url = `${MS_GRAPH_BASE}/me/onlineMeetings/${encodeURIComponent(meetingId)}`;
      const res = await this.fetchWithRefresh(credentials, url, { method: 'DELETE' });

      if (!res.ok && res.status !== 404) {
        const errorBody = await res.text();
        throw new Error(`Delete meeting failed: ${res.status} ${errorBody}`);
      }

      this.logger.log(`MS Teams meeting deleted: ${meetingId}`);
    } catch (err) {
      this.logger.error('deleteMeeting failed', (err as Error).stack);
      throw err;
    }
  }
}
