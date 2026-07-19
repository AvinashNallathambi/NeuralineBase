// ─────────────────────────────────────────────────────────────────────────────
// Twilio SMS Provider — implements SmsProvider via Twilio REST API
// ─────────────────────────────────────────────────────────────────────────────

import { Logger } from '@nestjs/common';
import {
  FaxRequest,
  FaxResult,
  SmsMessage,
  SmsProvider,
  SmsResult,
  VoiceCallRequest,
  VoiceCallResult,
} from './sms-provider.interface';

const TWILIO_BASE = 'https://api.twilio.com/2010-04-01/Accounts';

export class TwilioSmsProvider implements SmsProvider {
  readonly name = 'twilio-sms';
  private readonly logger = new Logger(TwilioSmsProvider.name);

  // ── Helpers ──────────────────────────────────────────────────────────────

  private getAccountSid(credentials: Record<string, unknown>): string {
    const sid = credentials['accountSid'] as string;
    if (!sid) throw new Error('Missing accountSid in credentials');
    return sid;
  }

  private getAuthToken(credentials: Record<string, unknown>): string {
    const token = credentials['authToken'] as string;
    if (!token) throw new Error('Missing authToken in credentials');
    return token;
  }

  private getFromNumber(credentials: Record<string, unknown>): string {
    const from = credentials['fromNumber'] as string;
    if (!from) throw new Error('Missing fromNumber in credentials');
    return from;
  }

  /** Build Basic Auth header value from accountSid:authToken */
  private getBasicAuthHeader(credentials: Record<string, unknown>): string {
    const sid = this.getAccountSid(credentials);
    const token = this.getAuthToken(credentials);
    const encoded = Buffer.from(`${sid}:${token}`).toString('base64');
    return `Basic ${encoded}`;
  }

  /** Build the base API URL for this account */
  private getAccountUrl(credentials: Record<string, unknown>): string {
    return `${TWILIO_BASE}/${this.getAccountSid(credentials)}`;
  }

  // ── SmsProvider implementation ───────────────────────────────────────────

  async testConnection(
    credentials: Record<string, unknown>,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const url = this.getAccountUrl(credentials) + '.json';
      const res = await fetch(url, {
        headers: { Authorization: this.getBasicAuthHeader(credentials) },
      });

      if (!res.ok) {
        const body = await res.text();
        return { success: false, message: `Twilio auth failed: ${res.status} ${body}` };
      }

      const data = await res.json();
      return {
        success: true,
        message: `Twilio connected (account: ${data['friendly_name'] ?? data['sid']})`,
      };
    } catch (err) {
      this.logger.error('testConnection failed', (err as Error).stack);
      return { success: false, message: (err as Error).message };
    }
  }

  async sendSms(
    credentials: Record<string, unknown>,
    message: SmsMessage,
  ): Promise<SmsResult> {
    try {
      const url = `${this.getAccountUrl(credentials)}/Messages.json`;
      const form = new URLSearchParams();
      form.append('To', message.to);
      form.append('From', message.from ?? this.getFromNumber(credentials));
      form.append('Body', message.body);
      if (message.mediaUrls) {
        for (const mediaUrl of message.mediaUrls) {
          form.append('MediaUrl', mediaUrl);
        }
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: this.getBasicAuthHeader(credentials),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form,
      });

      if (!res.ok) {
        const errorBody = await res.text();
        this.logger.error(`sendSms failed: ${res.status} ${errorBody}`);
        return {
          messageId: '',
          status: 'failed',
          error: `Twilio error: ${errorBody}`,
        };
      }

      const data = await res.json();
      return {
        messageId: data['sid'] as string,
        status: (data['status'] as SmsResult['status']) || 'queued',
        segments: data['num_segments'] ? parseInt(data['num_segments'], 10) : undefined,
        cost: data['price'] ? parseFloat(data['price']) : undefined,
      };
    } catch (err) {
      this.logger.error('sendSms failed', (err as Error).stack);
      return {
        messageId: '',
        status: 'failed',
        error: (err as Error).message,
      };
    }
  }

  async makeCall(
    credentials: Record<string, unknown>,
    request: VoiceCallRequest,
  ): Promise<VoiceCallResult> {
    try {
      const url = `${this.getAccountUrl(credentials)}/Calls.json`;
      const form = new URLSearchParams();
      form.append('To', request.to);
      form.append('From', request.from ?? this.getFromNumber(credentials));
      if (request.webhookUrl) {
        form.append('Url', request.webhookUrl);
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: this.getBasicAuthHeader(credentials),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form,
      });

      if (!res.ok) {
        const errorBody = await res.text();
        this.logger.error(`makeCall failed: ${res.status} ${errorBody}`);
        return {
          callId: '',
          status: 'failed',
          error: `Twilio error: ${errorBody}`,
        };
      }

      const data = await res.json();
      return {
        callId: data['sid'] as string,
        status: (data['status'] as VoiceCallResult['status']) || 'queued',
      };
    } catch (err) {
      this.logger.error('makeCall failed', (err as Error).stack);
      return {
        callId: '',
        status: 'failed',
        error: (err as Error).message,
      };
    }
  }

  async sendFax(
    credentials: Record<string, unknown>,
    request: FaxRequest,
  ): Promise<FaxResult> {
    try {
      const url = `${this.getAccountUrl(credentials)}/Faxes.json`;
      const form = new URLSearchParams();
      form.append('To', request.to);
      form.append('From', request.from ?? this.getFromNumber(credentials));
      if (request.documentUrl) {
        form.append('MediaUrl', request.documentUrl);
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: this.getBasicAuthHeader(credentials),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form,
      });

      if (!res.ok) {
        const errorBody = await res.text();
        this.logger.error(`sendFax failed: ${res.status} ${errorBody}`);
        return {
          faxId: '',
          status: 'failed',
          error: `Twilio error: ${errorBody}`,
        };
      }

      const data = await res.json();
      return {
        faxId: data['sid'] as string,
        status: (data['status'] as FaxResult['status']) || 'queued',
      };
    } catch (err) {
      this.logger.error('sendFax failed', (err as Error).stack);
      return {
        faxId: '',
        status: 'failed',
        error: (err as Error).message,
      };
    }
  }

  async getMessageStatus(
    credentials: Record<string, unknown>,
    messageId: string,
  ): Promise<SmsResult> {
    try {
      const url = `${this.getAccountUrl(credentials)}/Messages/${encodeURIComponent(messageId)}.json`;
      const res = await fetch(url, {
        headers: { Authorization: this.getBasicAuthHeader(credentials) },
      });

      if (!res.ok) {
        const errorBody = await res.text();
        this.logger.error(`getMessageStatus failed: ${res.status} ${errorBody}`);
        return {
          messageId,
          status: 'failed',
          error: `Twilio error: ${errorBody}`,
        };
      }

      const data = await res.json();
      return {
        messageId: data['sid'] as string,
        status: (data['status'] as SmsResult['status']) || 'queued',
        segments: data['num_segments'] ? parseInt(data['num_segments'], 10) : undefined,
        cost: data['price'] ? parseFloat(data['price']) : undefined,
        error: data['error_message'] as string,
      };
    } catch (err) {
      this.logger.error('getMessageStatus failed', (err as Error).stack);
      return {
        messageId,
        status: 'failed',
        error: (err as Error).message,
      };
    }
  }

  parseWebhook(body: Record<string, unknown>): {
    type: 'sms' | 'voice' | 'fax';
    from: string;
    to: string;
    body?: string;
    messageId: string;
  } {
    const messageSid = (body['MessageSid'] as string) || '';
    const callSid = (body['CallSid'] as string) || '';
    const faxSid = (body['FaxSid'] as string) || '';

    let type: 'sms' | 'voice' | 'fax' = 'sms';
    let messageId = messageSid;

    if (callSid) {
      type = 'voice';
      messageId = callSid;
    } else if (faxSid) {
      type = 'fax';
      messageId = faxSid;
    }

    return {
      type,
      from: (body['From'] as string) || '',
      to: (body['To'] as string) || '',
      body: body['Body'] as string,
      messageId,
    };
  }
}
