import { Injectable, Logger } from '@nestjs/common';
import {
  TelemedicineProvider,
  CreateRoomRequest,
  CreateRoomResponse,
  TokenRequest,
  TokenResponse,
} from './telemedicine-provider.interface';

/**
 * Mock telemedicine provider for development without Daily.co / Twilio.
 * Simulates room creation and token generation for local WebRTC signaling.
 */
@Injectable()
export class MockTelemedicineProvider implements TelemedicineProvider {
  readonly name = 'mock';
  private readonly logger = new Logger(MockTelemedicineProvider.name);
  private readonly rooms = new Map<string, CreateRoomResponse>();

  async createRoom(request: CreateRoomRequest): Promise<CreateRoomResponse> {
    this.logger.log(`Mock room created: ${request.roomId}`);
    const response: CreateRoomResponse = {
      roomId: request.roomId,
      roomUrl: `mock://${request.roomId}`,
      providerToken: `mock_provider_${request.roomId}_${Date.now()}`,
      patientToken: `mock_patient_${request.roomId}_${Date.now()}`,
    };
    this.rooms.set(request.roomId, response);
    return response;
  }

  async getToken(request: TokenRequest): Promise<TokenResponse> {
    this.logger.log(`Mock token issued for ${request.userId} in ${request.roomId}`);
    const room = this.rooms.get(request.roomId);
    const token = `mock_${request.role}_${request.roomId}_${request.userId}_${Date.now()}`;
    const expiresInMs = (request.expiresInMinutes ?? 60) * 60_000;
    return {
      token,
      roomUrl: room?.roomUrl || `mock://${request.roomId}`,
      expiresAt: new Date(Date.now() + expiresInMs),
    };
  }

  async deleteRoom(roomId: string): Promise<void> {
    this.logger.log(`Mock room deleted: ${roomId}`);
    this.rooms.delete(roomId);
  }
}
