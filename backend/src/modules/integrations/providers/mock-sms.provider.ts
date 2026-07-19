// ─────────────────────────────────────────────────────────────────────────────
// Mock SMS Provider — in-memory implementation for development/testing
// ─────────────────────────────────────────────────────────────────────────────

import { Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  FaxRequest,
  FaxResult,
  SmsMessage,
  SmsProvider,
  SmsResult,
  VoiceCallRequest,
  VoiceCallResult,
} from './sms-provider.interface';

export class MockSmsProvider implements SmsProvider {
  readonly name = 'mock-sms';
  private readonly logger = new Logger(MockSmsProvider.name);
  private readonly messages = new Map<string, SmsResult>();
  private readonly calls = new Map<string, VoiceCallResult>();
  private readonly faxes = new Map<string, FaxResult>();

  async testConnection(
    _credentials: Record<string, unknown>,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.log('Mock SMS connection test — always succeeds');
    return { success: true, message: 'Mock SMS connected' };
  }

  async sendSms(
    _credentials: Record<string, unknown>,
    message: SmsMessage,
  ): Promise<SmsResult> {
    const messageId = `mock-${randomUUID()}`;
    const result: SmsResult = {
      messageId,
      status: 'sent',
      segments: 1,
      cost: 0,
    };
    this.messages.set(messageId, result);
    this.logger.log(
      `Mock SMS sent to ${message.to}: "${message.body}" (id=${messageId})`,
    );
    return result;
  }

  async makeCall(
    _credentials: Record<string, unknown>,
    request: VoiceCallRequest,
  ): Promise<VoiceCallResult> {
    const callId = `mock-call-${randomUUID()}`;
    const result: VoiceCallResult = {
      callId,
      status: 'completed',
    };
    this.calls.set(callId, result);
    this.logger.log(
      `Mock call initiated to ${request.to} (id=${callId})`,
    );
    return result;
  }

  async sendFax(
    _credentials: Record<string, unknown>,
    request: FaxRequest,
  ): Promise<FaxResult> {
    const faxId = `mock-fax-${randomUUID()}`;
    const result: FaxResult = {
      faxId,
      status: 'sent',
    };
    this.faxes.set(faxId, result);
    this.logger.log(
      `Mock fax sent to ${request.to} (id=${faxId})`,
    );
    return result;
  }

  async getMessageStatus(
    _credentials: Record<string, unknown>,
    messageId: string,
  ): Promise<SmsResult> {
    const stored = this.messages.get(messageId);
    if (stored) {
      return stored;
    }
    return {
      messageId,
      status: 'failed',
      error: 'Message not found in mock store',
    };
  }

  parseWebhook(body: Record<string, unknown>): {
    type: 'sms' | 'voice' | 'fax';
    from: string;
    to: string;
    body?: string;
    messageId: string;
  } {
    return {
      type: (body['type'] as 'sms' | 'voice' | 'fax') || 'sms',
      from: (body['from'] as string) || '',
      to: (body['to'] as string) || '',
      body: body['body'] as string,
      messageId: (body['messageId'] as string) || `mock-${randomUUID()}`,
    };
  }
}
