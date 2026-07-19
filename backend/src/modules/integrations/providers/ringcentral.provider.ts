// ─────────────────────────────────────────────────────────────────────────────
// RingCentral Provider — implements SmsProvider via RingCentral REST API
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

const RC_PRODUCTION = 'https://platform.ringcentral.com';
const RC_SANDBOX = 'https://platform.devtest.ringcentral.com';

export class RingCentralProvider implements SmsProvider {
  readonly name = 'ringcentral';
  private readonly logger = new Logger(RingCentralProvider.name);

  // ── Helpers ──────────────────────────────────────────────────────────────

  private getBaseUrl(credentials: Record<string, unknown>): string {
    const env = (credentials['environment'] as string) || 'production';
    return env === 'sandbox' ? RC_SANDBOX : RC_PRODUCTION;
  }

  private getAccessToken(credentials: Record<string, unknown>): string {
    const token = credentials['accessToken'] as string;
    if (!token) throw new Error('Missing accessToken in credentials');
    return token;
  }

  private getFromNumber(credentials: Record<string, unknown>): string {
    const from = credentials['fromNumber'] as string;
    if (!from) throw new Error('Missing fromNumber in credentials');
    return from;
  }

  private getAuthHeader(credentials: Record<string, unknown>): string {
    return `Bearer ${this.getAccessToken(credentials)}`;
  }

  // ── SmsProvider implementation ───────────────────────────────────────────

  async testConnection(
    credentials: Record<string, unknown>,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const url = `${this.getBaseUrl(credentials)}/restapi/v1.0/account/~`;
      const res = await fetch(url, {
        headers: { Authorization: this.getAuthHeader(credentials) },
      });

      if (!res.ok) {
        const body = await res.text();
        return { success: false, message: `RingCentral auth failed: ${res.status} ${body}` };
      }

      const data = await res.json();
      return {
        success: true,
        message: `RingCentral connected (account: ${data['name'] ?? data['id']})`,
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
      const url = `${this.getBaseUrl(credentials)}/restapi/v1.0/account/~/extension/~/sms`;
      const body: Record<string, unknown> = {
        from: { phoneNumber: message.from ?? this.getFromNumber(credentials) },
        to: [{ phoneNumber: message.to }],
        text: message.body,
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: this.getAuthHeader(credentials),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errorBody = await res.text();
        this.logger.error(`sendSms failed: ${res.status} ${errorBody}`);
        return {
          messageId: '',
          status: 'failed',
          error: `RingCentral error: ${errorBody}`,
        };
      }

      const data = await res.json();
      return {
        messageId: data['id'] as string,
        status: (data['messageStatus'] as SmsResult['status']) || 'sent',
        segments: data['segments'] ? parseInt(data['segments'], 10) : undefined,
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
      const url = `${this.getBaseUrl(credentials)}/restapi/v1.0/account/~/extension/~/ringout`;
      const body: Record<string, unknown> = {
        from: { phoneNumber: request.from ?? this.getFromNumber(credentials) },
        to: { phoneNumber: request.to },
      };
      if (request.webhookUrl) {
        body['playPrompt'] = true;
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: this.getAuthHeader(credentials),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errorBody = await res.text();
        this.logger.error(`makeCall failed: ${res.status} ${errorBody}`);
        return {
          callId: '',
          status: 'failed',
          error: `RingCentral error: ${errorBody}`,
        };
      }

      const data = await res.json();
      return {
        callId: data['id'] as string,
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
      const url = `${this.getBaseUrl(credentials)}/restapi/v1.0/account/~/extension/~/fax`;
      // RingCentral fax API uses multipart/form-data with attachments
      const form = new FormData();
      form.append(
        'json',
        JSON.stringify({
          to: [{ phoneNumber: request.to }],
          from: { phoneNumber: request.from ?? this.getFromNumber(credentials) },
          coverPageText: request.metadata?.['coverPageText'] as string,
        }),
      );

      if (request.documentUrl) {
        form.append('attachment', request.documentUrl);
      } else if (request.documentBase64) {
        const buffer = Buffer.from(request.documentBase64, 'base64');
        const blob = new Blob([buffer], { type: 'application/pdf' });
        form.append('attachment', blob, 'document.pdf');
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: this.getAuthHeader(credentials),
        },
        body: form,
      });

      if (!res.ok) {
        const errorBody = await res.text();
        this.logger.error(`sendFax failed: ${res.status} ${errorBody}`);
        return {
          faxId: '',
          status: 'failed',
          error: `RingCentral error: ${errorBody}`,
        };
      }

      const data = await res.json();
      return {
        faxId: data['id'] as string,
        status: (data['messageStatus'] as FaxResult['status']) || 'queued',
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
      const url = `${this.getBaseUrl(credentials)}/restapi/v1.0/account/~/extension/~/message-store/${encodeURIComponent(messageId)}`;
      const res = await fetch(url, {
        headers: { Authorization: this.getAuthHeader(credentials) },
      });

      if (!res.ok) {
        const errorBody = await res.text();
        this.logger.error(`getMessageStatus failed: ${res.status} ${errorBody}`);
        return {
          messageId,
          status: 'failed',
          error: `RingCentral error: ${errorBody}`,
        };
      }

      const data = await res.json();
      return {
        messageId: data['id'] as string,
        status: (data['messageStatus'] as SmsResult['status']) || 'sent',
        segments: data['segments'] ? parseInt(data['segments'], 10) : undefined,
        cost: data['price'] ? parseFloat(data['price']) : undefined,
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
    const bodyObj = body['body'] as Record<string, unknown> | undefined;
    const messageType = (bodyObj?.['messageType'] as string) || 'SMS';

    let type: 'sms' | 'voice' | 'fax' = 'sms';
    if (messageType === 'Fax') {
      type = 'fax';
    } else if (messageType === 'VoiceMail' || messageType === 'Voice') {
      type = 'voice';
    }

    const fromInfo = bodyObj?.['from'] as Record<string, unknown> | undefined;
    const toInfo = bodyObj?.['to'] as Array<Record<string, unknown>> | undefined;

    return {
      type,
      from: (fromInfo?.['phoneNumber'] as string) || '',
      to: (toInfo?.[0]?.['phoneNumber'] as string) || '',
      body: bodyObj?.['subject'] as string,
      messageId: (bodyObj?.['id'] as string) || (body['uuid'] as string) || '',
    };
  }
}
