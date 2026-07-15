export interface CreateRoomRequest {
  roomId: string;
  appointmentId?: string | null;
  tenantId: string;
  providerId: string;
  patientId: string;
  durationMinutes?: number;
  enableRecording?: boolean;
}

export interface CreateRoomResponse {
  roomUrl: string;
  roomId: string;
  providerToken?: string;
  patientToken?: string;
}

export interface TokenRequest {
  roomId: string;
  userId: string;
  role: 'provider' | 'patient' | 'interpreter';
  expiresInMinutes?: number;
}

export interface TokenResponse {
  token: string;
  roomUrl: string;
  expiresAt?: Date;
}

export interface WebhookEvent {
  type: 'recording.completed' | 'recording.failed' | 'participant.joined' | 'participant.left' | 'room.finished';
  roomId: string;
  payload: Record<string, unknown>;
}

export interface TelemedicineProvider {
  readonly name: string;
  createRoom(request: CreateRoomRequest): Promise<CreateRoomResponse>;
  getToken(request: TokenRequest): Promise<TokenResponse>;
  deleteRoom(roomId: string): Promise<void>;
  parseWebhook?(rawBody: string | Record<string, unknown>, signature?: string): WebhookEvent | null;
}

export const TELEMEDICINE_PROVIDER = Symbol('TELEMEDICINE_PROVIDER');
