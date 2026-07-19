import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiService } from '../ai/ai.service';
import { AssemblyAiTranscriptionService, TranscriptionResult } from '../ai/assemblyai-transcription.service';
import { HipaaAuditService } from '../../common/services/hipaa-audit.service';
import { EncounterService } from './encounter.service';
import { EncounterStatus, EncounterType } from './entities/encounter.entity';
import {
  DocumentationConsentStatus,
  DocumentationSession,
  DocumentationSessionStatus,
  DocumentationSoapNote,
} from './entities/documentation-session.entity';
import {
  DocumentationNoteVersion,
  DocumentationNoteVersionSource,
} from './entities/documentation-note-version.entity';
import { CreateDocumentationSessionDto } from './dto/create-documentation-session.dto';
import { UpdateDocumentationNoteDto } from './dto/update-documentation-note.dto';

export interface DocumentationActor {
  id: string;
  email: string;
  role: string;
}

@Injectable()
export class DocumentationService {
  constructor(
    @InjectRepository(DocumentationSession)
    private readonly sessionRepository: Repository<DocumentationSession>,
    @InjectRepository(DocumentationNoteVersion)
    private readonly versionRepository: Repository<DocumentationNoteVersion>,
    private readonly transcriptionService: AssemblyAiTranscriptionService,
    private readonly aiService: AiService,
    private readonly encounterService: EncounterService,
    private readonly hipaaAuditService: HipaaAuditService,
  ) {}

  async createSession(
    tenantId: string,
    actor: DocumentationActor,
    dto: CreateDocumentationSessionDto,
  ): Promise<DocumentationSession> {
    if (dto.providerId && dto.providerId !== actor.id && !['admin', 'nurse'].includes(actor.role)) {
      throw new ForbiddenException('Only administrators or clinical support staff can create a documentation session for another provider.');
    }

    const providerId = dto.providerId || actor.id;
    let encounterId = dto.encounterId || null;
    if (encounterId) {
      const encounter = await this.encounterService.findOne(encounterId, tenantId);
      if (encounter.patientId !== dto.patientId) {
        throw new BadRequestException('The documentation session patient must match the linked encounter.');
      }
    } else {
      const encounter = await this.encounterService.create(tenantId, {
        patientId: dto.patientId,
        providerId,
        type: EncounterType.OFFICE_VISIT,
        status: EncounterStatus.IN_PROGRESS,
        startTime: new Date().toISOString(),
      });
      encounterId = encounter.id;
    }

    const session = this.sessionRepository.create({
      tenantId,
      encounterId,
      patientId: dto.patientId,
      providerId,
      consentStatus: dto.consentStatus,
      consentCapturedBy: dto.consentStatus === DocumentationConsentStatus.PENDING ? null : actor.id,
      consentCapturedAt: dto.consentStatus === DocumentationConsentStatus.PENDING ? null : new Date(),
      consentMethod: dto.consentMethod || null,
      transcriptUtterances: [],
      soapNote: {},
      metadata: {},
    });
    const saved = await this.sessionRepository.save(session);
    await this.audit(actor, tenantId, saved.id, 'DOCUMENTATION_SESSION_CREATED');
    return saved;
  }

  async findOne(tenantId: string, sessionId: string): Promise<DocumentationSession> {
    const session = await this.sessionRepository.findOne({ where: { id: sessionId, tenantId } });
    if (!session) throw new NotFoundException(`Documentation session ${sessionId} not found`);
    return session;
  }

  async getVersions(tenantId: string, sessionId: string): Promise<DocumentationNoteVersion[]> {
    await this.findOne(tenantId, sessionId);
    return this.versionRepository.find({
      where: { tenantId, sessionId },
      order: { versionNumber: 'DESC' },
    });
  }

  async transcribeAudio(
    tenantId: string,
    actor: DocumentationActor,
    sessionId: string,
    file: Express.Multer.File,
  ): Promise<DocumentationSession> {
    const session = await this.findOne(tenantId, sessionId);
    this.assertEditable(session);
    if (!file?.buffer?.length) throw new BadRequestException('Audio file is required.');
    if (session.consentStatus !== DocumentationConsentStatus.GRANTED && session.consentStatus !== DocumentationConsentStatus.PROVIDER_DICTATION) {
      throw new BadRequestException('Documented patient consent or provider-dictation mode is required before transcription.');
    }

    const result = await this.transcriptionService.transcribeAudioBuffer(file.buffer, file.mimetype);
    await this.applyTranscript(session, result);
    await this.audit(actor, tenantId, session.id, 'DOCUMENTATION_AUDIO_TRANSCRIBED', {
      durationSeconds: result.duration,
      languageCode: result.languageCode,
      audioRetentionPolicy: session.audioRetentionPolicy,
    });
    return session;
  }

  async saveTranscript(
    tenantId: string,
    actor: DocumentationActor,
    sessionId: string,
    transcript: string,
    languageCode?: string,
  ): Promise<DocumentationSession> {
    const session = await this.findOne(tenantId, sessionId);
    this.assertEditable(session);
    if (!transcript.trim()) throw new BadRequestException('Transcript cannot be empty.');
    session.transcript = transcript.trim();
    session.transcriptLanguage = languageCode || null;
    session.transcriptConfidence = null;
    session.transcriptUtterances = [];
    session.status = DocumentationSessionStatus.TRANSCRIBED;
    session.audioDeletedAt = new Date();
    await this.sessionRepository.save(session);
    await this.audit(actor, tenantId, session.id, 'DOCUMENTATION_TRANSCRIPT_SAVED', { languageCode });
    return session;
  }

  async generateNote(tenantId: string, actor: DocumentationActor, sessionId: string): Promise<DocumentationSession> {
    const session = await this.findOne(tenantId, sessionId);
    this.assertEditable(session);
    if (!session.transcript?.trim()) throw new BadRequestException('A transcript is required before generating a note.');

    const note = await this.aiService.generateStructured<DocumentationSoapNote>(
      `You are a medical documentation assistant. Create a factual draft SOAP note from the transcript below. Do not invent facts, diagnoses, exams, medications, orders, or measurements. If information is not stated, omit it. The provider must review and sign the draft.\n\nTranscript:\n"""${session.transcript}"""\n\nReturn only JSON with string fields: subjective, objective, assessment, plan.`,
      { temperature: 0.1, maxTokens: 2048 },
    );

    session.soapNote = this.normalizeNote(note);
    session.status = DocumentationSessionStatus.NOTE_GENERATED;
    await this.sessionRepository.save(session);
    await this.createVersion(session, DocumentationNoteVersionSource.AI_GENERATED, actor.id);
    await this.audit(actor, tenantId, session.id, 'DOCUMENTATION_NOTE_GENERATED');
    return session;
  }

  async updateNote(
    tenantId: string,
    actor: DocumentationActor,
    sessionId: string,
    dto: UpdateDocumentationNoteDto,
  ): Promise<DocumentationSession> {
    const session = await this.findOne(tenantId, sessionId);
    this.assertEditable(session);
    const updatedSections = Object.fromEntries(
      Object.entries(dto)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => [key, value?.trim() || '']),
    ) as DocumentationSoapNote;
    session.soapNote = { ...session.soapNote, ...updatedSections };
    session.status = DocumentationSessionStatus.REVIEWED;
    await this.sessionRepository.save(session);
    await this.createVersion(session, DocumentationNoteVersionSource.CLINICIAN_EDITED, actor.id);
    await this.audit(actor, tenantId, session.id, 'DOCUMENTATION_NOTE_REVIEWED');
    return session;
  }

  async applyToEncounter(tenantId: string, actor: DocumentationActor, sessionId: string): Promise<DocumentationSession> {
    const session = await this.findOne(tenantId, sessionId);
    this.assertEditable(session);
    if (!session.encounterId) throw new BadRequestException('A linked encounter is required before applying a note.');
    if (!Object.values(session.soapNote).some(Boolean)) throw new BadRequestException('A reviewed note is required before applying it to an encounter.');

    await this.encounterService.update(session.encounterId, { soapNote: session.soapNote }, tenantId);
    session.status = DocumentationSessionStatus.REVIEWED;
    await this.sessionRepository.save(session);
    await this.audit(actor, tenantId, session.id, 'DOCUMENTATION_NOTE_APPLIED_TO_ENCOUNTER', { encounterId: session.encounterId });
    return session;
  }

  async sign(tenantId: string, actor: DocumentationActor, sessionId: string): Promise<DocumentationSession> {
    const session = await this.findOne(tenantId, sessionId);
    this.assertEditable(session);
    if (session.providerId !== actor.id && actor.role !== 'admin') {
      throw new ForbiddenException('Only the session provider or an administrator can sign this documentation.');
    }
    if (!session.encounterId) throw new BadRequestException('A linked encounter is required before signing documentation.');
    if (!Object.values(session.soapNote).some(Boolean)) throw new BadRequestException('A reviewed note is required before signing.');

    await this.encounterService.update(session.encounterId, { soapNote: session.soapNote }, tenantId);
    const encounter = await this.encounterService.findOne(session.encounterId, tenantId);
    if (encounter.status === EncounterStatus.IN_PROGRESS) {
      await this.encounterService.transitionStatus(session.encounterId, EncounterStatus.COMPLETED, actor.id, tenantId);
    }
    await this.encounterService.sign(session.encounterId, actor.id, tenantId);
    session.status = DocumentationSessionStatus.SIGNED;
    session.signedAt = new Date();
    session.signedBy = actor.id;
    await this.sessionRepository.save(session);
    await this.createVersion(session, DocumentationNoteVersionSource.SIGNED, actor.id);
    await this.audit(actor, tenantId, session.id, 'DOCUMENTATION_NOTE_SIGNED', { encounterId: session.encounterId });
    return session;
  }

  private async applyTranscript(session: DocumentationSession, result: TranscriptionResult): Promise<void> {
    session.transcript = result.text;
    session.transcriptLanguage = result.languageCode || null;
    session.transcriptConfidence = result.confidence;
    session.transcriptUtterances = result.utterances || [];
    session.status = DocumentationSessionStatus.TRANSCRIBED;
    session.audioDeletedAt = new Date();
    await this.sessionRepository.save(session);
  }

  private async createVersion(
    session: DocumentationSession,
    source: DocumentationNoteVersionSource,
    createdBy: string,
  ): Promise<void> {
    const latest = await this.versionRepository.findOne({
      where: { sessionId: session.id },
      order: { versionNumber: 'DESC' },
    });
    await this.versionRepository.save(
      this.versionRepository.create({
        sessionId: session.id,
        tenantId: session.tenantId,
        versionNumber: (latest?.versionNumber || 0) + 1,
        source,
        soapNote: session.soapNote,
        createdBy,
        aiModel: source === DocumentationNoteVersionSource.AI_GENERATED ? session.aiModel : null,
      }),
    );
  }

  private normalizeNote(note: DocumentationSoapNote): DocumentationSoapNote {
    return {
      subjective: note.subjective?.trim() || '',
      objective: note.objective?.trim() || '',
      assessment: note.assessment?.trim() || '',
      plan: note.plan?.trim() || '',
    };
  }

  private assertEditable(session: DocumentationSession): void {
    if (session.status === DocumentationSessionStatus.SIGNED || session.status === DocumentationSessionStatus.CANCELLED) {
      throw new BadRequestException(`Documentation session is ${session.status} and cannot be modified.`);
    }
  }

  private async audit(
    actor: DocumentationActor,
    tenantId: string,
    sessionId: string,
    action: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.hipaaAuditService.log({
      tenantId,
      userId: actor.id,
      userEmail: actor.email,
      userRole: actor.role,
      action,
      resourceType: 'documentation_session',
      resourceId: sessionId,
      metadata,
    });
  }
}
