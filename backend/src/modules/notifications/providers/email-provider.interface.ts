export interface SendEmailRequest {
  to: string;
  toName?: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  fromName?: string;
  metadata?: Record<string, unknown>;
}

export interface SendEmailResponse {
  messageId: string;
  status: 'sent' | 'failed' | 'queued';
  error?: string;
}

export interface EmailProvider {
  readonly name: string;
  send(request: SendEmailRequest): Promise<SendEmailResponse>;
}

export const EMAIL_PROVIDER = Symbol('EMAIL_PROVIDER');
