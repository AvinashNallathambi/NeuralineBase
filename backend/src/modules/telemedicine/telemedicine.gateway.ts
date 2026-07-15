import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TelemedicineService } from './telemedicine.service';
import { TelemedicineSessionStatus } from './entities/telemedicine-session.entity';

interface JwtPayload {
  sub: string;
  email: string;
  tenantId: string;
  role: string;
  type?: string;
}

interface AuthenticatedSocket extends Socket {
  user?: JwtPayload;
  sessionId?: string;
  roomId?: string;
  participantRole?: 'provider' | 'patient' | 'interpreter';
}

@WebSocketGateway({
  namespace: 'telemedicine',
  cors: { origin: '*' }, // Configure appropriately in production
})
@Injectable()
export class TelemedicineGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(TelemedicineGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly telemedicineService: TelemedicineService,
  ) {}

  afterInit() {
    this.logger.log('Telemedicine WebSocket gateway initialized');
  }

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token = this.extractToken(client);
      if (!token) {
        this.logger.warn('Connection rejected: no token');
        return client.disconnect();
      }

      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.get<string>('JWT_SECRET', 'default-secret'),
      });

      // Reject patient portal tokens for staff-specific actions if needed.
      // Both staff and patient tokens include tenantId/role.
      client.user = payload;
      this.logger.debug(`Client connected: ${client.id} (user ${payload.sub}, role ${payload.role})`);
    } catch (error: any) {
      this.logger.warn(`Connection rejected: invalid token (${error.message})`);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    this.logger.debug(`Client disconnected: ${client.id}`);
    if (client.roomId) {
      client.to(client.roomId).emit('participant-left', {
        socketId: client.id,
        userId: client.user?.sub,
      });
    }
  }

  @SubscribeMessage('join-room')
  async handleJoinRoom(
    client: AuthenticatedSocket,
    payload: { sessionId: string; role: 'provider' | 'patient' | 'interpreter'; name: string },
  ) {
    if (!client.user) {
      return { event: 'error', data: { message: 'Not authenticated' } };
    }

    const { sessionId, role, name } = payload;
    const session = await this.telemedicineService.findOne(client.user.tenantId, sessionId).catch(() => null);
    if (!session) {
      return { event: 'error', data: { message: 'Session not found' } };
    }

    // Authorization: provider or patient can only join their own session
    if (
      role === 'provider' && session.providerId !== client.user.sub && client.user.role !== 'admin'
    ) {
      return { event: 'error', data: { message: 'Not authorized to join as provider' } };
    }
    if (
      role === 'patient' && session.patientId !== client.user.sub && client.user.role !== 'admin'
    ) {
      return { event: 'error', data: { message: 'Not authorized to join as patient' } };
    }

    await this.telemedicineService.addParticipant(sessionId, {
      userId: client.user.sub,
      role,
      name,
      socketId: client.id,
    });

    client.sessionId = sessionId;
    client.roomId = session.roomId;
    client.participantRole = role;
    await client.join(session.roomId);

    if (role === 'provider') {
      await this.telemedicineService.markInProgress(sessionId, client.user.sub).catch(() => undefined);
      this.server.to(session.roomId).emit('session-in-progress', { sessionId, startedAt: new Date().toISOString() });
    }

    client.to(session.roomId).emit('participant-joined', {
      socketId: client.id,
      userId: client.user.sub,
      role,
      name,
    });

    return {
      event: 'joined-room',
      data: {
        sessionId,
        roomId: session.roomId,
        role,
        participants: session.participants || [],
      },
    };
  }

  @SubscribeMessage('leave-room')
  async handleLeaveRoom(client: AuthenticatedSocket) {
    if (!client.roomId || !client.user || !client.sessionId) {
      return { event: 'left-room', data: {} };
    }

    await this.telemedicineService.removeParticipant(client.sessionId, client.user.sub).catch(() => undefined);
    client.to(client.roomId).emit('participant-left', {
      socketId: client.id,
      userId: client.user.sub,
    });
    await client.leave(client.roomId);

    return { event: 'left-room', data: {} };
  }

  // WebRTC signaling messages
  @SubscribeMessage('offer')
  handleOffer(client: AuthenticatedSocket, payload: { targetSocketId: string; sdp: RTCSessionDescriptionInit }) {
    this.server.to(payload.targetSocketId).emit('offer', {
      sdp: payload.sdp,
      callerSocketId: client.id,
      callerUserId: client.user?.sub,
    });
  }

  @SubscribeMessage('answer')
  handleAnswer(client: AuthenticatedSocket, payload: { targetSocketId: string; sdp: RTCSessionDescriptionInit }) {
    this.server.to(payload.targetSocketId).emit('answer', {
      sdp: payload.sdp,
      calleeSocketId: client.id,
      calleeUserId: client.user?.sub,
    });
  }

  @SubscribeMessage('ice-candidate')
  handleIceCandidate(client: AuthenticatedSocket, payload: { targetSocketId: string; candidate: RTCIceCandidateInit }) {
    this.server.to(payload.targetSocketId).emit('ice-candidate', {
      candidate: payload.candidate,
      senderSocketId: client.id,
    });
  }

  @SubscribeMessage('chat-message')
  async handleChatMessage(client: AuthenticatedSocket, payload: { text: string }) {
    if (!client.sessionId || !client.user || !client.participantRole) {
      return { event: 'error', data: { message: 'Not in a room' } };
    }

    const message = await this.telemedicineService.addChatMessage(client.sessionId, {
      senderId: client.user.sub,
      senderName: client.user.email,
      senderRole: client.participantRole,
      text: payload.text,
    });

    this.server.to(client.roomId!).emit('chat-message', message);
    return { event: 'chat-message-sent', data: message };
  }

  @SubscribeMessage('screen-share-state')
  handleScreenShareState(client: AuthenticatedSocket, payload: { isSharing: boolean }) {
    if (!client.roomId) return;
    client.to(client.roomId).emit('screen-share-state', {
      socketId: client.id,
      userId: client.user?.sub,
      isSharing: payload.isSharing,
    });
  }

  @SubscribeMessage('connection-quality')
  async handleConnectionQuality(
    client: AuthenticatedSocket,
    payload: { bitrate?: number; packetLoss?: number },
  ) {
    if (!client.sessionId || !client.user) return;
    await this.telemedicineService.updateConnectionQuality(
      client.user.tenantId,
      client.sessionId,
      client.user.sub,
      payload,
    ).catch(() => undefined);
  }

  @SubscribeMessage('request-recording-consent')
  async handleRecordingConsentRequest(client: AuthenticatedSocket) {
    if (!client.roomId) return { event: 'error', data: { message: 'Not in a room' } };
    client.to(client.roomId).emit('recording-consent-requested', { requestedBy: client.user?.sub });
    return { event: 'recording-consent-requested', data: {} };
  }

  @SubscribeMessage('recording-consent-response')
  async handleRecordingConsentResponse(client: AuthenticatedSocket, payload: { consented: boolean }) {
    if (!client.roomId) return { event: 'error', data: { message: 'Not in a room' } };
    this.server.to(client.roomId).emit('recording-consent-response', {
      userId: client.user?.sub,
      consented: payload.consented,
    });
    return { event: 'recording-consent-response', data: { consented: payload.consented } };
  }

  private extractToken(client: AuthenticatedSocket): string | null {
    const auth = client.handshake.headers.authorization || client.handshake.auth?.token;
    if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
      return auth.substring(7);
    }
    return typeof auth === 'string' ? auth : null;
  }
}
