// ─────────────────────────────────────────────────────────────────────────────
// Mock Video Provider — in-memory implementation for development/testing
// ─────────────────────────────────────────────────────────────────────────────

import { Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  CreateMeetingRequest,
  CreateMeetingResult,
  VideoProvider,
} from './video-provider.interface';

interface StoredMeeting extends CreateMeetingResult {
  topic: string;
  startTime: Date;
  durationMinutes: number;
  timezone?: string;
  agenda?: string;
  settings?: CreateMeetingRequest['settings'];
}

export class MockVideoProvider implements VideoProvider {
  readonly name = 'mock-video';
  private readonly logger = new Logger(MockVideoProvider.name);
  private readonly meetings = new Map<string, StoredMeeting>();

  async testConnection(
    _credentials: Record<string, unknown>,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.log('Mock video connection test — always succeeds');
    return { success: true, message: 'Mock video provider connected' };
  }

  async createMeeting(
    _credentials: Record<string, unknown>,
    request: CreateMeetingRequest,
  ): Promise<CreateMeetingResult> {
    const meetingId = `mock-${randomUUID()}`;
    const joinUrl = `https://mock-meeting.example.com/join/${meetingId}`;

    const meeting: StoredMeeting = {
      meetingId,
      joinUrl,
      hostUrl: `https://mock-meeting.example.com/host/${meetingId}`,
      password: 'mock-pass',
      topic: request.topic,
      startTime: request.startTime,
      durationMinutes: request.durationMinutes,
      timezone: request.timezone,
      agenda: request.agenda,
      settings: request.settings,
    };

    this.meetings.set(meetingId, meeting);
    this.logger.log(`Mock video: created meeting "${request.topic}" (${meetingId})`);

    return {
      meetingId,
      joinUrl,
      hostUrl: meeting.hostUrl,
      password: meeting.password,
    };
  }

  async getMeeting(
    _credentials: Record<string, unknown>,
    meetingId: string,
  ): Promise<CreateMeetingResult> {
    const meeting = this.meetings.get(meetingId);
    if (!meeting) {
      throw new Error(`Meeting ${meetingId} not found`);
    }
    return {
      meetingId: meeting.meetingId,
      joinUrl: meeting.joinUrl,
      hostUrl: meeting.hostUrl,
      password: meeting.password,
    };
  }

  async updateMeeting(
    _credentials: Record<string, unknown>,
    meetingId: string,
    request: Partial<CreateMeetingRequest>,
  ): Promise<CreateMeetingResult> {
    const meeting = this.meetings.get(meetingId);
    if (!meeting) {
      throw new Error(`Meeting ${meetingId} not found`);
    }

    if (request.topic !== undefined) meeting.topic = request.topic;
    if (request.startTime !== undefined) meeting.startTime = request.startTime;
    if (request.durationMinutes !== undefined) meeting.durationMinutes = request.durationMinutes;
    if (request.timezone !== undefined) meeting.timezone = request.timezone;
    if (request.agenda !== undefined) meeting.agenda = request.agenda;
    if (request.settings !== undefined) meeting.settings = request.settings;

    this.meetings.set(meetingId, meeting);
    this.logger.log(`Mock video: updated meeting ${meetingId}`);

    return {
      meetingId: meeting.meetingId,
      joinUrl: meeting.joinUrl,
      hostUrl: meeting.hostUrl,
      password: meeting.password,
    };
  }

  async deleteMeeting(
    _credentials: Record<string, unknown>,
    meetingId: string,
  ): Promise<void> {
    if (this.meetings.delete(meetingId)) {
      this.logger.log(`Mock video: deleted meeting ${meetingId}`);
    }
  }

  async getJoinToken(
    _credentials: Record<string, unknown>,
    meetingId: string,
    participantName: string,
    role: 'host' | 'guest',
  ): Promise<{ token: string; joinUrl: string }> {
    const meeting = this.meetings.get(meetingId);
    if (!meeting) {
      throw new Error(`Meeting ${meetingId} not found`);
    }

    const token = `mock-token-${randomUUID()}`;
    this.logger.log(
      `Mock video: generated join token for ${participantName} (${role}) to meeting ${meetingId}`,
    );

    return {
      token,
      joinUrl: `${meeting.joinUrl}?token=${token}&name=${encodeURIComponent(participantName)}&role=${role}`,
    };
  }
}
