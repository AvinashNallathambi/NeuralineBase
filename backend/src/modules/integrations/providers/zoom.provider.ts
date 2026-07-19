// ─────────────────────────────────────────────────────────────────────────────
// Zoom Video Provider — implements VideoProvider via Zoom Server-to-Server OAuth
// ─────────────────────────────────────────────────────────────────────────────

import { Logger } from '@nestjs/common';
import {
  CreateMeetingRequest,
  CreateMeetingResult,
  VideoProvider,
} from './video-provider.interface';

const ZOOM_OAUTH_TOKEN_URL = 'https://zoom.us/oauth/token';
const ZOOM_API_BASE = 'https://api.zoom.us/v2';

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

export class ZoomProvider implements VideoProvider {
  readonly name = 'zoom';
  private readonly logger = new Logger(ZoomProvider.name);

  /** Cached token keyed by accountId to avoid re-authenticating on every call */
  private readonly tokenCache = new Map<string, CachedToken>();

  // ── Helpers ──────────────────────────────────────────────────────────────

  private getAccountId(credentials: Record<string, unknown>): string {
    const id = credentials['accountId'] as string;
    if (!id) throw new Error('Missing accountId in credentials');
    return id;
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

  /** Get a valid access token, fetching a new one if the cached one is expired */
  private async getAccessToken(credentials: Record<string, unknown>): Promise<string> {
    const accountId = this.getAccountId(credentials);

    const cached = this.tokenCache.get(accountId);
    if (cached && cached.expiresAt > Date.now() + 60_000) {
      return cached.accessToken;
    }

    const clientId = this.getClientId(credentials);
    const clientSecret = this.getClientSecret(credentials);
    const encoded = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const url = `${ZOOM_OAUTH_TOKEN_URL}?grant_type=account_credentials&account_id=${encodeURIComponent(accountId)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${encoded}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (!res.ok) {
      const errorBody = await res.text();
      this.logger.error(`Zoom OAuth failed: ${res.status} ${errorBody}`);
      throw new Error(`Zoom OAuth failed: ${errorBody}`);
    }

    const data = await res.json();
    const accessToken = data['access_token'] as string;
    const expiresIn = (data['expires_in'] as number) || 3600;

    this.tokenCache.set(accountId, {
      accessToken,
      expiresAt: Date.now() + expiresIn * 1000,
    });

    this.logger.log(`Zoom token acquired for account ${accountId} (expires in ${expiresIn}s)`);
    return accessToken;
  }

  /** Execute an authenticated API call with auto token retrieval */
  private async apiCall(
    credentials: Record<string, unknown>,
    url: string,
    init: RequestInit,
  ): Promise<Response> {
    const token = await this.getAccessToken(credentials);
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${token}`);
    return fetch(url, { ...init, headers });
  }

  /** Convert CreateMeetingRequest to Zoom meeting body */
  private toZoomMeeting(request: CreateMeetingRequest): Record<string, unknown> {
    return {
      topic: request.topic,
      type: 2, // Scheduled meeting
      start_time: request.startTime.toISOString().replace(/\.\d{3}Z$/, 'Z'),
      duration: request.durationMinutes,
      timezone: request.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      agenda: request.agenda,
      settings: {
        waiting_room: request.settings?.waitingRoom ?? true,
        join_before_host: request.settings?.joinBeforeHost ?? false,
        mute_upon_entry: request.settings?.muteUponEntry ?? true,
        auto_recording: request.settings?.enableRecording ? 'cloud' : 'none',
        chat: request.settings?.enableChat ?? true,
      },
    };
  }

  /** Map Zoom meeting response to our CreateMeetingResult */
  private fromZoomMeeting(data: Record<string, unknown>): CreateMeetingResult {
    return {
      meetingId: String(data['id'] ?? ''),
      joinUrl: (data['join_url'] as string) || '',
      hostUrl: (data['start_url'] as string) || undefined,
      password: (data['password'] as string) || undefined,
      dialInNumbers: data['dial_in_numbers'] as string[] | undefined,
      providerMeetingId: String(data['id'] ?? ''),
    };
  }

  // ── VideoProvider implementation ─────────────────────────────────────────

  async testConnection(
    credentials: Record<string, unknown>,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const token = await this.getAccessToken(credentials);
      const res = await fetch(`${ZOOM_API_BASE}/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const body = await res.text();
        return { success: false, message: `Zoom auth failed: ${res.status} ${body}` };
      }

      const data = await res.json();
      return {
        success: true,
        message: `Zoom connected as ${data['email'] ?? data['display_name'] ?? 'user'}`,
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
      const url = `${ZOOM_API_BASE}/users/me/meetings`;
      const res = await this.apiCall(credentials, url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.toZoomMeeting(request)),
      });

      if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(`Create meeting failed: ${res.status} ${errorBody}`);
      }

      const data = await res.json();
      this.logger.log(`Zoom meeting created: "${request.topic}" (id=${data['id']})`);
      return this.fromZoomMeeting(data);
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
      const url = `${ZOOM_API_BASE}/meetings/${encodeURIComponent(meetingId)}`;
      const res = await this.apiCall(credentials, url, { method: 'GET' });

      if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(`Get meeting failed: ${res.status} ${errorBody}`);
      }

      const data = await res.json();
      return this.fromZoomMeeting(data);
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
      const url = `${ZOOM_API_BASE}/meetings/${encodeURIComponent(meetingId)}`;
      const body: Record<string, unknown> = {};
      if (request.topic !== undefined) body['topic'] = request.topic;
      if (request.startTime !== undefined) {
        body['start_time'] = request.startTime.toISOString().replace(/\.\d{3}Z$/, 'Z');
      }
      if (request.durationMinutes !== undefined) body['duration'] = request.durationMinutes;
      if (request.timezone !== undefined) body['timezone'] = request.timezone;
      if (request.agenda !== undefined) body['agenda'] = request.agenda;
      if (request.settings !== undefined) {
        body['settings'] = {
          waiting_room: request.settings.waitingRoom,
          join_before_host: request.settings.joinBeforeHost,
          mute_upon_entry: request.settings.muteUponEntry,
          auto_recording: request.settings.enableRecording ? 'cloud' : 'none',
          chat: request.settings.enableChat,
        };
      }

      const res = await this.apiCall(credentials, url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(`Update meeting failed: ${res.status} ${errorBody}`);
      }

      // Zoom PATCH returns 204 No Content; fetch updated meeting
      return this.getMeeting(credentials, meetingId);
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
      const url = `${ZOOM_API_BASE}/meetings/${encodeURIComponent(meetingId)}`;
      const res = await this.apiCall(credentials, url, { method: 'DELETE' });

      if (!res.ok && res.status !== 404) {
        const errorBody = await res.text();
        throw new Error(`Delete meeting failed: ${res.status} ${errorBody}`);
      }

      this.logger.log(`Zoom meeting deleted: ${meetingId}`);
    } catch (err) {
      this.logger.error('deleteMeeting failed', (err as Error).stack);
      throw err;
    }
  }
}
