// ─────────────────────────────────────────────────────────────────────────────
// SMS / Communication Provider Interface
// ─────────────────────────────────────────────────────────────────────────────

export interface SmsMessage {
  to: string;
  from?: string;
  body: string;
  mediaUrls?: string[];
  metadata?: Record<string, unknown>;
}

export interface SmsResult {
  messageId: string;
  status: 'queued' | 'sent' | 'delivered' | 'failed' | 'undelivered';
  error?: string;
  segments?: number;
  cost?: number;
}

export interface VoiceCallRequest {
  to: string;
  from?: string;
  /** URL that returns TwiML/RCCML for call instructions */
  webhookUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface VoiceCallResult {
  callId: string;
  status: 'queued' | 'ringing' | 'in-progress' | 'completed' | 'failed' | 'busy' | 'no-answer';
  error?: string;
}

export interface FaxRequest {
  to: string;
  from?: string;
  /** URL or base64 of the document to fax */
  documentUrl?: string;
  documentBase64?: string;
  metadata?: Record<string, unknown>;
}

export interface FaxResult {
  faxId: string;
  status: 'queued' | 'sending' | 'sent' | 'failed';
  error?: string;
}

export interface SmsProvider {
  readonly name: string;

  /** Test that the credentials are valid */
  testConnection(credentials: Record<string, unknown>): Promise<{ success: boolean; message: string }>;

  /** Send an SMS message */
  sendSms(credentials: Record<string, unknown>, message: SmsMessage): Promise<SmsResult>;

  /** Initiate a voice call (click-to-call) */
  makeCall?(credentials: Record<string, unknown>, request: VoiceCallRequest): Promise<VoiceCallResult>;

  /** Send a fax */
  sendFax?(credentials: Record<string, unknown>, request: FaxRequest): Promise<FaxResult>;

  /** Get delivery status of a message */
  getMessageStatus?(credentials: Record<string, unknown>, messageId: string): Promise<SmsResult>;

  /** Parse inbound webhook */
  parseWebhook?(body: Record<string, unknown>): { type: 'sms' | 'voice' | 'fax'; from: string; to: string; body?: string; messageId: string };
}

export const SMS_PROVIDER = Symbol('SMS_PROVIDER');
