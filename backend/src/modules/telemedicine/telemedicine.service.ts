import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import {
  TelemedicineSession,
  TelemedicineSessionStatus,
  RecordingStatus,
  TelemedicineParticipant,
  TelemedicineChatMessage,
  SharedFile,
} from './entities/telemedicine-session.entity';
import {
  TELEMEDICINE_PROVIDER,
  TelemedicineProvider,
} from './providers/telemedicine-provider.interface';
import { AppointmentsService } from '../appointments/appointments.service';
import { EncounterService } from '../clinical/encounter.service';
import { SuperbillsService } from '../superbills/superbills.service';
import { PatientsService } from '../patients/patients.service';
import { AiService } from '../ai/ai.service';
import { HipaaAuditService } from '../../common/services/hipaa-audit.service';
import { EncounterType, EncounterStatus } from '../clinical/entities/encounter.entity';
import { SuperbillStatus } from '../superbills/entities/superbill.entity';
import { DiagnosisType } from '../superbills/entities/superbill-diagnosis.entity';
import { IntegrationsService } from '../integrations/integrations.service';
import {
  CreateMeetingRequest,
  CreateMeetingResult,
} from '../integrations/providers/video-provider.interface';

export interface CreateSessionDto {
  appointmentId?: string | null;
  patientId: string;
  providerId: string;
  enableRecording?: boolean;
  recordingConsent?: boolean;
}

export interface JoinSessionDto {
  role: 'provider' | 'patient' | 'interpreter';
  name: string;
  userId: string;
}

export interface SessionStatsFilters {
  tenantId: string;
  providerId?: string;
  patientId?: string;
  startDate?: Date;
  endDate?: Date;
}

@Injectable()
export class TelemedicineService {
  private readonly logger = new Logger(TelemedicineService.name);

  constructor(
    @InjectRepository(TelemedicineSession)
    private readonly sessionRepository: Repository<TelemedicineSession>,
    @Inject(TELEMEDICINE_PROVIDER)
    private readonly provider: TelemedicineProvider,
    private readonly appointmentsService: AppointmentsService,
    private readonly encounterService: EncounterService,
    private readonly superbillsService: SuperbillsService,
    private readonly patientsService: PatientsService,
    private readonly aiService: AiService,
    private readonly hipaaAuditService: HipaaAuditService,
    private readonly integrationsService: IntegrationsService,
  ) {}

  async createSession(
    tenantId: string,
    dto: CreateSessionDto,
    performedBy: string,
  ): Promise<TelemedicineSession> {
    const roomId = `room_${uuidv4().replace(/-/g, '')}`;

    // Validate appointment belongs to tenant and is telehealth if provided
    let appointmentId: string | null = null;
    if (dto.appointmentId) {
      const appointment = await this.appointmentsService.findOne(tenantId, dto.appointmentId);
      if (!appointment.isTelehealth) {
        throw new BadRequestException('Appointment is not a telehealth visit');
      }
      appointmentId = appointment.id;
    }

    const session = this.sessionRepository.create({
      tenantId,
      appointmentId,
      patientId: dto.patientId,
      providerId: dto.providerId,
      roomId,
      status: TelemedicineSessionStatus.SCHEDULED,
      participants: [],
      chatMessages: [],
      sharedFiles: [],
      recordingConsent: dto.recordingConsent ?? false,
      recordingStatus: RecordingStatus.NOT_STARTED,
      transcript: null,
      soapNote: {},
      suggestedCodes: null,
      encounterId: null,
      superbillId: null,
      providerNotes: null,
      connectionQuality: null,
      metadata: {
        providerName: dto.providerId,
        recordingRequested: dto.enableRecording ?? false,
      },
    });

    const saved = await this.sessionRepository.save(session);

    // Create managed room if a real provider is configured
    try {
      await this.provider.createRoom({
        roomId,
        appointmentId: saved.appointmentId,
        tenantId,
        providerId: dto.providerId,
        patientId: dto.patientId,
        durationMinutes: 60,
        enableRecording: dto.enableRecording ?? false,
      });
    } catch (error: any) {
      this.logger.error(`Failed to create provider room: ${error.message}`);
      // Continue — native WebRTC signaling will still work
    }

    await this.hipaaAuditService.log({
      tenantId,
      userId: performedBy,
      action: 'TELEMEDICINE_SESSION_CREATED',
      resourceType: 'TelemedicineSession',
      resourceId: saved.id,
      metadata: { roomId, appointmentId: saved.appointmentId },
    });

    return saved;
  }

  async findAll(
    tenantId: string,
    options: {
      page: number;
      limit: number;
      status?: TelemedicineSessionStatus;
      patientId?: string;
      providerId?: string;
    },
  ): Promise<{ data: TelemedicineSession[]; total: number; page: number; limit: number; totalPages: number }> {
    const { page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const query = this.sessionRepository
      .createQueryBuilder('session')
      .where('session.tenantId = :tenantId', { tenantId });

    if (options.status) {
      query.andWhere('session.status = :status', { status: options.status });
    }
    if (options.patientId) {
      query.andWhere('session.patientId = :patientId', { patientId: options.patientId });
    }
    if (options.providerId) {
      query.andWhere('session.providerId = :providerId', { providerId: options.providerId });
    }

    query.orderBy('session.createdAt', 'DESC').skip(skip).take(limit);

    const [data, total] = await query.getManyAndCount();
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(tenantId: string, id: string): Promise<TelemedicineSession> {
    const session = await this.sessionRepository.findOne({ where: { id, tenantId } });
    if (!session) {
      throw new NotFoundException(`Telemedicine session ${id} not found`);
    }
    return session;
  }

  async findByRoomId(roomId: string): Promise<TelemedicineSession | null> {
    return this.sessionRepository.findOne({ where: { roomId } });
  }

  async getToken(
    tenantId: string,
    sessionId: string,
    userId: string,
    role: 'provider' | 'patient' | 'interpreter',
  ): Promise<{ token: string; roomUrl: string; roomId: string }> {
    const session = await this.findOne(tenantId, sessionId);

    const tokenResponse = await this.provider.getToken({
      roomId: session.roomId,
      userId,
      role,
      expiresInMinutes: 120,
    });

    return {
      token: tokenResponse.token,
      roomUrl: tokenResponse.roomUrl,
      roomId: session.roomId,
    };
  }

  async addParticipant(
    sessionId: string,
    participant: TelemedicineParticipant,
  ): Promise<TelemedicineSession> {
    const session = await this.sessionRepository.findOne({ where: { id: sessionId } });
    if (!session) {
      throw new NotFoundException(`Session ${sessionId} not found`);
    }

    const existing = session.participants.find((p) => p.userId === participant.userId);
    if (!existing) {
      session.participants = [
        ...session.participants,
        {
          ...participant,
          joinedAt: new Date().toISOString(),
        },
      ];
    } else {
      existing.socketId = participant.socketId;
      existing.joinedAt = new Date().toISOString();
    }

    if (session.status === TelemedicineSessionStatus.SCHEDULED) {
      session.status = TelemedicineSessionStatus.WAITING;
    }

    return this.sessionRepository.save(session);
  }

  async markInProgress(sessionId: string, performedBy: string): Promise<TelemedicineSession> {
    const session = await this.sessionRepository.findOne({ where: { id: sessionId } });
    if (!session) {
      throw new NotFoundException(`Session ${sessionId} not found`);
    }

    session.status = TelemedicineSessionStatus.IN_PROGRESS;
    if (!session.startedAt) {
      session.startedAt = new Date();
    }

    await this.hipaaAuditService.log({
      tenantId: session.tenantId,
      userId: performedBy,
      action: 'TELEMEDICINE_SESSION_STARTED',
      resourceType: 'TelemedicineSession',
      resourceId: session.id,
      metadata: { roomId: session.roomId },
    });

    return this.sessionRepository.save(session);
  }

  async removeParticipant(sessionId: string, userId: string): Promise<TelemedicineSession> {
    const session = await this.sessionRepository.findOne({ where: { id: sessionId } });
    if (!session) {
      throw new NotFoundException(`Session ${sessionId} not found`);
    }

    session.participants = session.participants.map((p) =>
      p.userId === userId ? { ...p, leftAt: new Date().toISOString() } : p,
    );

    return this.sessionRepository.save(session);
  }

  async addChatMessage(
    sessionId: string,
    message: Omit<TelemedicineChatMessage, 'id' | 'sentAt'>,
  ): Promise<TelemedicineChatMessage> {
    const session = await this.sessionRepository.findOne({ where: { id: sessionId } });
    if (!session) {
      throw new NotFoundException(`Session ${sessionId} not found`);
    }

    const chatMessage: TelemedicineChatMessage = {
      id: uuidv4(),
      ...message,
      sentAt: new Date().toISOString(),
    };

    session.chatMessages = [...(session.chatMessages || []), chatMessage];
    await this.sessionRepository.save(session);
    return chatMessage;
  }

  async addSharedFile(
    sessionId: string,
    file: Omit<SharedFile, 'id' | 'uploadedAt'>,
  ): Promise<SharedFile> {
    const session = await this.sessionRepository.findOne({ where: { id: sessionId } });
    if (!session) {
      throw new NotFoundException(`Session ${sessionId} not found`);
    }

    const sharedFile: SharedFile = {
      id: uuidv4(),
      ...file,
      uploadedAt: new Date().toISOString(),
    };

    session.sharedFiles = [...(session.sharedFiles || []), sharedFile];
    await this.sessionRepository.save(session);
    return sharedFile;
  }

  async appendTranscript(sessionId: string, transcriptChunk: string): Promise<TelemedicineSession> {
    const session = await this.sessionRepository.findOne({ where: { id: sessionId } });
    if (!session) {
      throw new NotFoundException(`Session ${sessionId} not found`);
    }

    session.transcript = session.transcript ? `${session.transcript}\n${transcriptChunk}` : transcriptChunk;
    return this.sessionRepository.save(session);
  }

  async endSession(
    tenantId: string,
    sessionId: string,
    performedBy: string,
    options: {
      transcript?: string;
      providerNotes?: string;
      generateEncounter?: boolean;
      generateSuperbill?: boolean;
    } = {},
  ): Promise<TelemedicineSession> {
    const session = await this.findOne(tenantId, sessionId);

    if (session.status === TelemedicineSessionStatus.COMPLETED ||
        session.status === TelemedicineSessionStatus.CANCELLED ||
        session.status === TelemedicineSessionStatus.NO_SHOW) {
      throw new BadRequestException(`Session is already ${session.status}`);
    }

    session.endedAt = new Date();
    session.status = TelemedicineSessionStatus.COMPLETED;
    if (options.transcript) {
      session.transcript = options.transcript;
    }
    if (options.providerNotes) {
      session.providerNotes = options.providerNotes;
    }
    if (session.startedAt && session.endedAt) {
      session.durationMinutes = Math.round(
        (session.endedAt.getTime() - session.startedAt.getTime()) / 60000,
      );
    }

    // Update appointment status if linked
    if (session.appointmentId) {
      try {
        await this.appointmentsService.completeWorkflow(tenantId, session.appointmentId);
      } catch (error: any) {
        this.logger.error(`Failed to complete appointment workflow: ${error.message}`);
      }
    }

    // Generate AI SOAP note and suggested codes from transcript
    if (session.transcript && session.transcript.trim()) {
      try {
        const patient = await this.patientsService.findOne(tenantId, session.patientId);
        const chiefComplaint = session.appointmentId
          ? (await this.appointmentsService.findOne(tenantId, session.appointmentId)).reasonForVisit || undefined
          : undefined;

        const soapNote = await this.aiService.generateStructured<{
          subjective: string;
          objective: string;
          assessment: string;
          plan: string;
        }>(
          `Convert the following telemedicine encounter transcript into a structured SOAP note.\n\nTranscript:\n"""${session.transcript}"""\n\nChief Complaint: ${chiefComplaint || 'Not provided'}\n\nReturn ONLY JSON with keys: subjective, objective, assessment, plan.`,
          { temperature: 0.2, maxTokens: 2048 },
        );
        session.soapNote = soapNote;

        const suggestedCodes = await this.aiService.generateStructured<{
          diagnoses: Array<{ code: string; description: string; confidence: number; rationale: string }>;
          procedures: Array<{ code: string; description: string; confidence: number; rationale: string; suggestedModifiers?: string[] }>;
        }>(
          `Based on this SOAP note, suggest ICD-10 diagnoses and CPT procedures.\n\nSubjective: ${soapNote.subjective}\nObjective: ${soapNote.objective}\nAssessment: ${soapNote.assessment}\nPlan: ${soapNote.plan}\n\nReturn ONLY JSON with keys: diagnoses[], procedures[].`,
          { temperature: 0.2, maxTokens: 2048 },
        );
        session.suggestedCodes = suggestedCodes;
      } catch (error: any) {
        this.logger.error(`AI post-visit generation failed: ${error.message}`);
      }
    }

    // Create Encounter
    if (options.generateEncounter !== false) {
      try {
        const patient = await this.patientsService.findOne(tenantId, session.patientId);
        const encounter = await this.encounterService.create(tenantId, {
          patientId: session.patientId,
          providerId: session.providerId,
          appointmentId: session.appointmentId || undefined,
          type: EncounterType.TELEHEALTH,
          status: EncounterStatus.COMPLETED,
          visitReason: session.appointmentId
            ? (await this.appointmentsService.findOne(tenantId, session.appointmentId)).reasonForVisit || undefined
            : undefined,
          startTime: session.startedAt?.toISOString() || new Date().toISOString(),
          endTime: session.endedAt.toISOString(),
          durationMinutes: session.durationMinutes ?? undefined,
          soapNote: session.soapNote,
          clinicalNotes: session.providerNotes || undefined,
          diagnoses: session.suggestedCodes?.diagnoses?.map((d) => ({
            code: d.code,
            description: d.description,
            codeSystem: 'ICD-10-CM' as const,
            isPrimary: false,
            status: 'active' as const,
            notes: d.rationale,
          })),
          treatmentPlan: {
            medications: [],
            procedures: session.suggestedCodes?.procedures?.map((p) => ({
              name: p.description,
              cptCode: p.code,
              description: p.description,
              status: 'ordered',
            })),
            homeInstructions: session.providerNotes || undefined,
          },
        });
        session.encounterId = encounter.id;
      } catch (error: any) {
        this.logger.error(`Failed to create encounter: ${error.message}`);
      }
    }

    // Create draft Superbill
    if (options.generateSuperbill !== false && session.encounterId) {
      try {
        const patient = await this.patientsService.findOne(tenantId, session.patientId);
        const primaryInsurance = (patient.insurances as any[] || []).find((ins: any) =>
          ins.priority === 'primary' || ins.isPrimary,
        );

        if (primaryInsurance) {
          const totalAmount = session.suggestedCodes?.procedures?.reduce(
            (sum, p) => sum + (p.code?.startsWith('992') ? 200 : 150),
            0,
          ) || 0;

          const superbill = await this.superbillsService.create({
            patientId: session.patientId,
            patientName: `${patient.firstName} ${patient.lastName}`,
            patientDOB: patient.dateOfBirth?.toISOString().split('T')[0] || '',
            patientAddress: {
              street: patient.address?.street1 || '',
              city: patient.address?.city || '',
              state: patient.address?.state || '',
              zipCode: patient.address?.zipCode || '',
              country: patient.address?.country || 'US',
            },
            patientPhone: patient.phone || '',
            providerId: session.providerId,
            providerName: 'Provider', // Will be enriched by caller if needed
            providerNPI: '',
            providerAddress: {
              street: '',
              city: '',
              state: '',
              zipCode: '',
              country: 'US',
            },
            encounterId: session.encounterId,
            serviceDate: session.startedAt || new Date(),
            status: SuperbillStatus.DRAFT,
            insurance: {
              provider: primaryInsurance.payer?.name || primaryInsurance.provider || 'Unknown',
              policyNumber: primaryInsurance.policyNumber || '',
              groupNumber: primaryInsurance.groupNumber || '',
              subscriberName: primaryInsurance.subscriberName || '',
              subscriberRelation: primaryInsurance.subscriberRelation || '',
              payerId: primaryInsurance.payerId || primaryInsurance.payer?.id || '',
              authorizationNumber: primaryInsurance.authorizationNumber,
            },
            diagnoses: session.suggestedCodes?.diagnoses?.map((d) => ({
              icdCode: d.code,
              description: d.description,
              type: DiagnosisType.PRIMARY,
            })) || [],
            procedures: session.suggestedCodes?.procedures?.map((p) => ({
              cptCode: p.code,
              description: p.description,
              units: 1,
              charge: p.code?.startsWith('992') ? 200 : 150,
              serviceDate: session.startedAt || new Date(),
              diagnosisPointer: ['1'],
            })) || [],
            charges: [],
            totalAmount,
            patientResponsibility: totalAmount * 0.2,
            notes: `Auto-generated from telemedicine session ${session.roomId}. Provider should review codes and complete provider/NPI fields.`,
          });

          session.superbillId = superbill.id;
        }
      } catch (error: any) {
        this.logger.error(`Failed to create superbill: ${error.message}`);
      }
    }

    const saved = await this.sessionRepository.save(session);

    await this.hipaaAuditService.log({
      tenantId,
      userId: performedBy,
      action: 'TELEMEDICINE_SESSION_ENDED',
      resourceType: 'TelemedicineSession',
      resourceId: saved.id,
      metadata: {
        roomId: saved.roomId,
        durationMinutes: saved.durationMinutes,
        encounterId: saved.encounterId,
        superbillId: saved.superbillId,
      },
    });

    return saved;
  }

  async cancelSession(
    tenantId: string,
    sessionId: string,
    performedBy: string,
    reason?: string,
  ): Promise<TelemedicineSession> {
    const session = await this.findOne(tenantId, sessionId);
    session.status = TelemedicineSessionStatus.CANCELLED;
    session.endedAt = new Date();
    session.metadata = { ...session.metadata, cancellationReason: reason };

    const saved = await this.sessionRepository.save(session);

    await this.hipaaAuditService.log({
      tenantId,
      userId: performedBy,
      action: 'TELEMEDICINE_SESSION_CANCELLED',
      resourceType: 'TelemedicineSession',
      resourceId: saved.id,
      metadata: { reason },
    });

    return saved;
  }

  async updateConnectionQuality(
    tenantId: string,
    sessionId: string,
    userId: string,
    quality: { bitrate?: number; packetLoss?: number },
  ): Promise<TelemedicineSession> {
    const session = await this.findOne(tenantId, sessionId);
    const existing = session.connectionQuality || {};
    const ratings = existing.ratings || [];
    const idx = ratings.findIndex((r) => r.userId === userId);
    const ratingEntry = { userId, rating: this.scoreConnection(quality), feedback: `bitrate:${quality.bitrate},loss:${quality.packetLoss}` };
    if (idx >= 0) ratings[idx] = ratingEntry;
    else ratings.push(ratingEntry);

    session.connectionQuality = {
      ...existing,
      averageBitrate: quality.bitrate,
      packetLossPercent: quality.packetLoss,
      ratings,
    };

    return this.sessionRepository.save(session);
  }

  async getAnalytics(filters: SessionStatsFilters): Promise<{
    totalSessions: number;
    completedSessions: number;
    totalDurationMinutes: number;
    averageDurationMinutes: number;
    noShowCount: number;
    cancelledCount: number;
    sessionsByStatus: Record<string, number>;
    sessionsByDay: Record<string, number>;
  }> {
    const where: any = { tenantId: filters.tenantId };
    if (filters.providerId) where.providerId = filters.providerId;
    if (filters.patientId) where.patientId = filters.patientId;

    if (filters.startDate && filters.endDate) {
      where.createdAt = Between(filters.startDate, filters.endDate);
    }

    const sessions = await this.sessionRepository.find({ where });

    const totalDuration = sessions.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
    const completedSessions = sessions.filter((s) => s.status === TelemedicineSessionStatus.COMPLETED).length;

    const sessionsByDay: Record<string, number> = {};
    sessions.forEach((s) => {
      const day = s.createdAt.toISOString().split('T')[0];
      sessionsByDay[day] = (sessionsByDay[day] || 0) + 1;
    });

    const sessionsByStatus: Record<string, number> = {};
    sessions.forEach((s) => {
      sessionsByStatus[s.status] = (sessionsByStatus[s.status] || 0) + 1;
    });

    return {
      totalSessions: sessions.length,
      completedSessions,
      totalDurationMinutes: totalDuration,
      averageDurationMinutes: completedSessions ? Math.round(totalDuration / completedSessions) : 0,
      noShowCount: sessions.filter((s) => s.status === TelemedicineSessionStatus.NO_SHOW).length,
      cancelledCount: sessions.filter((s) => s.status === TelemedicineSessionStatus.CANCELLED).length,
      sessionsByStatus,
      sessionsByDay,
    };
  }

  async preVisitIntake(tenantId: string, sessionId: string, symptoms: string): Promise<{
    triage: { urgency: string; recommendation: string; suggestedSpecialty?: string };
    questions: string[];
  }> {
    await this.findOne(tenantId, sessionId);

    const prompt = `A patient reports the following symptoms before a telemedicine visit:\n"""${symptoms}"""\n\nReturn ONLY JSON with this shape:\n{\n  "triage": { "urgency": "self_care|schedule|urgent_care|emergency", "recommendation": "...", "suggestedSpecialty": "..." },\n  "questions": ["question 1", "question 2", "question 3"]\n}`;

    return this.aiService.generateStructured<{ triage: any; questions: string[] }>(prompt, {
      temperature: 0.2,
      maxTokens: 1024,
    });
  }

  async postVisitCarePlan(
    tenantId: string,
    sessionId: string,
  ): Promise<{ education: string[]; followUp: string; medications: string[]; warnings: string[] }> {
    const session = await this.findOne(tenantId, sessionId);

    const prompt = `Generate a patient-friendly post-visit care plan from this SOAP note and any provider notes.\n\nSOAP Note:\nSubjective: ${session.soapNote?.subjective || ''}\nObjective: ${session.soapNote?.objective || ''}\nAssessment: ${session.soapNote?.assessment || ''}\nPlan: ${session.soapNote?.plan || ''}\n\nProvider Notes: ${session.providerNotes || ''}\n\nReturn ONLY JSON with keys: education[], followUp, medications[], warnings[].`;

    return this.aiService.generateStructured<{ education: string[]; followUp: string; medications: string[]; warnings: string[] }>(
      prompt,
      { temperature: 0.3, maxTokens: 1536 },
    );
  }

  // ── Video Integration Methods ──────────────────────────────────────────────

  /**
   * Create a video meeting via the enabled video integration (Zoom, MS Teams, or Google Meet).
   * Returns the meeting join URL, or null if no video integration is enabled.
   */
  async createVideoMeeting(
    tenantId: string,
    params: {
      topic: string;
      startTime: Date;
      durationMinutes: number;
      appointmentId?: string;
    },
  ): Promise<CreateMeetingResult | null> {
    const videoKeys = ['zoom', 'ms_teams', 'google_meet'];

    for (const key of videoKeys) {
      try {
        const credentials = await this.integrationsService.getIntegrationCredentials(
          tenantId,
          key,
        );
        if (!credentials) {
          // Integration not enabled or not connected — skip silently
          continue;
        }

        const provider = this.integrationsService.getVideoProviderFor(key);

        const meetingRequest: CreateMeetingRequest = {
          topic: params.topic,
          startTime: params.startTime,
          durationMinutes: params.durationMinutes,
          metadata: {
            appointmentId: params.appointmentId,
            tenantId,
          },
        };

        const result = await provider.createMeeting(credentials, meetingRequest);
        this.logger.log(
          `Video meeting created via ${key}: meetingId=${result.meetingId}, joinUrl=${result.joinUrl}`,
        );

        return result;
      } catch (error: any) {
        this.logger.warn(`Video meeting creation via ${key} failed: ${error?.message || error}`);
      }
    }

    this.logger.debug(`No video integration enabled for tenant ${tenantId} — returning null`);
    return null;
  }

  /**
   * Get the video meeting join link for a given appointment.
   * Creates a new meeting if a video integration is enabled; returns null otherwise.
   */
  async getVideoMeetingLink(
    tenantId: string,
    appointmentId: string,
  ): Promise<string | null> {
    try {
      const appointment = await this.appointmentsService.findOne(tenantId, appointmentId);

      const startTime = appointment.startTime || new Date();
      const durationMinutes = appointment.durationMinutes ?? 60;

      const result = await this.createVideoMeeting(tenantId, {
        topic: appointment.reasonForVisit
          ? `Telehealth: ${appointment.reasonForVisit}`
          : `Telehealth Appointment`,
        startTime,
        durationMinutes,
        appointmentId: appointment.id,
      });

      return result?.joinUrl ?? null;
    } catch (error: any) {
      this.logger.warn(
        `Failed to get video meeting link for appointment ${appointmentId}: ${error?.message || error}`,
      );
      return null;
    }
  }

  private scoreConnection(quality: { bitrate?: number; packetLoss?: number }): number {
    if (quality.packetLoss === undefined || quality.bitrate === undefined) return 3;
    if (quality.packetLoss > 5 || quality.bitrate < 200000) return 2;
    if (quality.packetLoss > 1 || quality.bitrate < 500000) return 3;
    return 5;
  }
}
