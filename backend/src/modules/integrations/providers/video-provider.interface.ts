// ─────────────────────────────────────────────────────────────────────────────
// Video Conferencing Provider Interface
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateMeetingRequest {
  topic: string;
  startTime: Date;
  durationMinutes: number;
  timezone?: string;
  agenda?: string;
  /** Passcode or waiting room settings */
  settings?: {
    waitingRoom?: boolean;
    joinBeforeHost?: boolean;
    muteUponEntry?: boolean;
    enableRecording?: boolean;
    enableChat?: boolean;
  };
  metadata?: Record<string, unknown>;
}

export interface CreateMeetingResult {
  meetingId: string;
  joinUrl: string;
  hostUrl?: string;
  password?: string;
  dialInNumbers?: string[];
  providerMeetingId?: string;
}

export interface VideoProvider {
  readonly name: string;

  /** Test that the credentials are valid */
  testConnection(credentials: Record<string, unknown>): Promise<{ success: boolean; message: string }>;

  /** Get OAuth authorization URL */
  getAuthUrl?(redirectUri: string, state: string): string;

  /** Exchange OAuth code for tokens */
  exchangeCode?(code: string, redirectUri: string): Promise<Record<string, unknown>>;

  /** Create a meeting */
  createMeeting(credentials: Record<string, unknown>, request: CreateMeetingRequest): Promise<CreateMeetingResult>;

  /** Get meeting details */
  getMeeting(credentials: Record<string, unknown>, meetingId: string): Promise<CreateMeetingResult>;

  /** Update a meeting */
  updateMeeting(credentials: Record<string, unknown>, meetingId: string, request: Partial<CreateMeetingRequest>): Promise<CreateMeetingResult>;

  /** Delete a meeting */
  deleteMeeting(credentials: Record<string, unknown>, meetingId: string): Promise<void>;

  /** Generate a join token for a participant */
  getJoinToken?(credentials: Record<string, unknown>, meetingId: string, participantName: string, role: 'host' | 'guest'): Promise<{ token: string; joinUrl: string }>;
}

export const VIDEO_PROVIDER = Symbol('VIDEO_PROVIDER');
