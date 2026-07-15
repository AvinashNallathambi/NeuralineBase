import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  TelemedicineProvider,
  CreateRoomRequest,
  CreateRoomResponse,
  TokenRequest,
  TokenResponse,
  WebhookEvent,
} from './telemedicine-provider.interface';

/**
 * Daily.co provider for managed WebRTC video rooms.
 * Activated when DAILY_API_KEY is set.
 */
@Injectable()
export class DailyCoTelemedicineProvider implements TelemedicineProvider {
  readonly name = 'daily.co';
  private readonly logger = new Logger(DailyCoTelemedicineProvider.name);
  private readonly baseUrl = 'https://api.daily.co/v1';

  constructor(private readonly configService: ConfigService) {}

  private get apiKey(): string {
    const key = this.configService.get<string>('DAILY_API_KEY');
    if (!key) {
      throw new BadRequestException('DAILY_API_KEY is not configured');
    }
    return key;
  }

  private async fetchDaily<T>(path: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      this.logger.error(`Daily.co API error ${response.status}: ${text.slice(0, 300)}`);
      throw new BadRequestException(`Daily.co API error: ${response.status}`);
    }

    return response.json() as Promise<T>;
  }

  async createRoom(request: CreateRoomRequest): Promise<CreateRoomResponse> {
    this.logger.log(`Creating Daily.co room: ${request.roomId}`);

    const room = await this.fetchDaily<{ id: string; url: string; config: Record<string, unknown> }>(
      '/rooms',
      {
        method: 'POST',
        body: JSON.stringify({
          name: request.roomId,
          privacy: 'private',
          properties: {
            max_participants: 10,
            enable_screenshare: true,
            enable_chat: true,
            enable_recording: request.enableRecording ? 'cloud' : 'not-auto',
            exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24h
          },
        }),
      },
    );

    return {
      roomId: room.id,
      roomUrl: room.url,
    };
  }

  async getToken(request: TokenRequest): Promise<TokenResponse> {
    const roomUrl = `${this.baseUrl.replace('/v1', '')}/call/${request.roomId}`;
    const token = await this.fetchDaily<{ token: string }>('/meeting-tokens', {
      method: 'POST',
      body: JSON.stringify({
        room_name: request.roomId,
        user_id: request.userId,
        user_name: request.role === 'provider' ? 'Provider' : 'Patient',
        is_owner: request.role === 'provider',
        exp: Math.floor(Date.now() / 1000) + (request.expiresInMinutes ?? 60) * 60,
      }),
    });

    return {
      token: token.token,
      roomUrl,
      expiresAt: new Date(Date.now() + (request.expiresInMinutes ?? 60) * 60_000),
    };
  }

  async deleteRoom(roomId: string): Promise<void> {
    this.logger.log(`Deleting Daily.co room: ${roomId}`);
    await this.fetchDaily(`/rooms/${roomId}`, { method: 'DELETE' });
  }

  parseWebhook(rawBody: string | Record<string, unknown>): WebhookEvent | null {
    const payload = typeof rawBody === 'string' ? (JSON.parse(rawBody) as Record<string, unknown>) : rawBody;
    const type = payload?.type as string;
    const roomName = (payload?.room as string) || '';

    switch (type) {
      case 'recording.ready-to-download':
      case 'recording.completed':
        return {
          type: 'recording.completed',
          roomId: roomName,
          payload: payload,
        };
      case 'recording.error':
        return {
          type: 'recording.failed',
          roomId: roomName,
          payload: payload,
        };
      case 'participant.joined':
        return {
          type: 'participant.joined',
          roomId: roomName,
          payload: payload,
        };
      case 'participant.left':
        return {
          type: 'participant.left',
          roomId: roomName,
          payload: payload,
        };
      default:
        return null;
    }
  }
}
