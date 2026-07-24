import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Inject, forwardRef, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AiService } from '../ai/ai.service';
import { AssemblyAiTranscriptionService, TranscriptionResult } from '../ai/assemblyai-transcription.service';
import { HipaaAuditService } from '../../common/services/hipaa-audit.service';
import { EncounterService } from './encounter.service';
import { EncounterStatus, EncounterType } from './entities/encounter.entity';
import { MessagingService } from '../messaging/messaging.service';
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
import { DocumentationEvidence } from './entities/documentation-evidence.entity';
import {
  DocumentationSuggestion,
} from './entities/documentation-suggestion.entity';
import { PatientInsurance } from '../billing/entities/patient-insurance.entity';
import { CreateDocumentationSessionDto } from './dto/create-documentation-session.dto';
import { UpdateDocumentationNoteDto } from './dto/update-documentation-note.dto';
import { DocumentationIntelligenceService } from './documentation-intelligence.service';
import { DocumentationActionsService } from './documentation-actions.service';
import { DocumentationRevenueService } from './documentation-revenue.service';
import { getEffectiveRoles } from '../users/role-permissions';

export interface DocumentationActor {
  id: string;
  email: string;
  role: string;
}

export interface DocumentationSessionListFilters {
  patientId?: string;
  providerId?: string;
  status?: DocumentationSessionStatus;
  encounterId?: string;
  page?: number;
  limit?: number;
}

export interface DocumentationIntelligenceBundle {
  session: DocumentationSession;
  evidence: DocumentationEvidence[];
  quality: { score: number; findings: Array<{ severity: string; section: string; message: string }> };
  actionDrafts: DocumentationSuggestion[];
  payerPrompts: Array<{
    payerName: string;
    denialCount: number;
    unresolvedDeniedAmount: number;
    underpaymentCount: number;
    underpaymentAmount: number;
    topRootCauses: Array<{ rootCause: string; count: number }>;
    documentationPrompts: string[];
  }>;
}

@Injectable()
export class DocumentationService {
  constructor(
    @InjectRepository(DocumentationSession)
    private readonly sessionRepository: Repository<DocumentationSession>,
    @InjectRepository(DocumentationNoteVersion)
    private readonly versionRepository: Repository<DocumentationNoteVersion>,
    @InjectRepository(DocumentationEvidence)
    private readonly evidenceRepository: Repository<DocumentationEvidence>,
    @InjectRepository(DocumentationSuggestion)
    private readonly suggestionRepository: Repository<DocumentationSuggestion>,
    @InjectRepository(PatientInsurance)
    private readonly patientInsuranceRepository: Repository<PatientInsurance>,
    private readonly transcriptionService: AssemblyAiTranscriptionService,
    private readonly aiService: AiService,
    @Inject(forwardRef(() => EncounterService))
    private readonly encounterService: EncounterService,
    private readonly hipaaAuditService: HipaaAuditService,
    private readonly intelligenceService: DocumentationIntelligenceService,
    private readonly actionsService: DocumentationActionsService,
    private readonly revenueService: DocumentationRevenueService,
    private readonly messagingService: MessagingService,
  ) {}

  private readonly logger = new Logger(DocumentationService.name);

  async createSession(
    tenantId: string,
    actor: DocumentationActor,
    dto: CreateDocumentationSessionDto,
  ): Promise<DocumentationSession> {
    if (dto.providerId && dto.providerId !== actor.id) {
      const effectiveRoles = new Set(getEffectiveRoles(actor.role));
      if (!effectiveRoles.has('admin') && !effectiveRoles.has('nurse')) {
        throw new ForbiddenException('Only administrators or clinical support staff can create a documentation session for another provider.');
      }
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

    // Build chart context from the linked encounter (Roadmap #2: chart-context-aware note generation)
    let chartContext = '';
    if (session.encounterId) {
      try {
        const encounter = await this.encounterService.findOne(session.encounterId, tenantId);
        chartContext = this.buildChartContext(encounter);
      } catch {
        // encounter lookup is non-blocking — generate note with transcript only
      }
    }

    // Fetch provider documentation preferences
    let preferenceContext = '';
    try {
      const pref = await this.intelligenceService.getPreference(tenantId, session.providerId);
      if (pref) {
        const parts: string[] = [];
        if (pref.preferredLanguage && pref.preferredLanguage !== 'en') parts.push(`Language: ${pref.preferredLanguage}`);
        if (pref.noteStyle) parts.push(`Note style: ${pref.noteStyle}`);
        if (pref.requiredSections?.length) parts.push(`Required sections: ${pref.requiredSections.join(', ')}`);
        if (pref.doNotInfer?.length) parts.push(`Do NOT infer: ${pref.doNotInfer.join(', ')}`);
        if (pref.customInstructions) parts.push(`Custom instructions: ${pref.customInstructions}`);
        if (parts.length) preferenceContext = `\n\nProvider preferences:\n${parts.join('\n')}`;
      }
    } catch {
      // preference lookup is non-blocking
    }

    const prompt = `You are a medical documentation assistant. Create a factual draft SOAP note from the transcript below. Do not invent facts, diagnoses, exams, medications, orders, or measurements. If information is not stated in the transcript, omit it. You may reference the chart context below to organize the note, but do not add clinical findings that are not mentioned in the transcript. The provider must review and sign the draft.\n\nTranscript:\n"""${session.transcript}"""\n\n${chartContext}${preferenceContext}\n\nReturn only JSON with string fields: subjective, objective, assessment, plan.`;

    const note = await this.aiService.generateStructured<DocumentationSoapNote>(
      prompt,
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
    if (session.providerId !== actor.id) {
      const effectiveRoles = new Set(getEffectiveRoles(actor.role));
      if (!effectiveRoles.has('admin')) {
        throw new ForbiddenException('Only the session provider or an administrator can sign this documentation.');
      }
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

  // ---------------------------------------------------------------------------
  // Roadmap #7: AVS delivery to patient portal
  // ---------------------------------------------------------------------------

  /**
   * Send the after-visit summary to the patient via secure messaging.
   * Looks for an AFTER_VISIT_SUMMARY suggestion on the session, formats it,
   * and creates a conversation with the AVS content.
   */
  async sendAfterVisitSummary(
    tenantId: string,
    actor: DocumentationActor,
    sessionId: string,
  ): Promise<{ conversationId: string; messageId: string }> {
    const session = await this.findOne(tenantId, sessionId);

    // Find the AVS suggestion
    const suggestions = await this.actionsService.list(tenantId, sessionId);
    const avsDraft = suggestions.find(
      (s) => s.kind === 'after_visit_summary' && s.status === 'pending',
    );

    let avsContent: { summary: string; followUp: string; warnings: string[] };

    if (avsDraft) {
      avsContent = avsDraft.payload as any;
      // Mark the draft as accepted
      await this.actionsService.review(tenantId, avsDraft.id, 'accepted' as any, actor.id);
    } else {
      // Generate AVS on the fly from the SOAP note
      if (!Object.values(session.soapNote).some(Boolean)) {
        throw new BadRequestException('A SOAP note is required before generating an after-visit summary.');
      }
      const result = await this.aiService.generateStructured<{ summary: string; followUp: string; warnings: string[] }>(
        `Create a patient-friendly after-visit summary from the SOAP note below. Use plain language (no medical jargon). Include what was discussed, what the patient should do at home, and when to follow up. Do not invent information not in the note.\n\nSOAP: ${JSON.stringify(session.soapNote)}\n\nReturn JSON with: summary (string), followUp (string), warnings (array of strings).`,
        { temperature: 0.1, maxTokens: 1024 },
      );
      avsContent = result;
    }

    // Format the message
    const lines: string[] = [
      'After-Visit Summary',
      '===================',
      '',
      avsContent.summary,
      '',
    ];
    if (avsContent.followUp) {
      lines.push(`Follow-up: ${avsContent.followUp}`);
    }
    if (avsContent.warnings?.length) {
      lines.push('', 'Important warnings:');
      avsContent.warnings.forEach((w) => lines.push(`  • ${w}`));
    }
    const body = lines.join('\n');

    // Get patient name
    let patientName = 'Patient';
    try {
      const encounter = session.encounterId
        ? await this.encounterService.findOne(session.encounterId, tenantId)
        : null;
      if (encounter) {
        // Use patientId to look up patient — but we don't have PatientService injected
        // The messaging service will use patientId to associate the conversation
        patientName = `Patient ${session.patientId.slice(0, 8)}`;
      }
    } catch {
      // non-blocking
    }

    // Send via messaging service (provider → patient)
    const result = await this.messagingService.startConversation(
      tenantId,
      session.patientId,
      patientName,
      {
        subject: 'After-Visit Summary',
        body,
        priority: 'normal',
        providerId: session.providerId,
      },
    );

    await this.audit(actor, tenantId, session.id, 'DOCUMENTATION_AVS_SENT_TO_PATIENT', {
      conversationId: result.conversation.id,
      messageId: result.message.id,
    });

    return {
      conversationId: result.conversation.id,
      messageId: result.message.id,
    };
  }

  // ---------------------------------------------------------------------------
  // New methods for unified documentation surface (spec §3.2)
  // ---------------------------------------------------------------------------

  /**
   * Find an active documentation session for an encounter, or create a new one.
   * Seeds the SOAP note from the encounter's existing soapNote if creating.
   * Writes documentationSessionId back to the encounter for O(1) reverse lookup.
   */
  async findOrCreateForEncounter(
    tenantId: string,
    actor: DocumentationActor,
    encounterId: string,
  ): Promise<DocumentationSession> {
    const encounter = await this.encounterService.findOne(encounterId, tenantId);

    // Look for an active session linked to this encounter
    const existing = await this.sessionRepository.findOne({
      where: {
        tenantId,
        encounterId,
        status: In([
          DocumentationSessionStatus.DRAFT,
          DocumentationSessionStatus.TRANSCRIBED,
          DocumentationSessionStatus.NOTE_GENERATED,
          DocumentationSessionStatus.REVIEWED,
        ]),
      },
    });
    if (existing) return existing;

    // Create a new session linked to the encounter, seeded from the encounter's SOAP
    const session = this.sessionRepository.create({
      tenantId,
      encounterId,
      patientId: encounter.patientId,
      providerId: encounter.providerId,
      consentStatus: DocumentationConsentStatus.GRANTED,
      consentCapturedBy: actor.id,
      consentCapturedAt: new Date(),
      consentMethod: 'encounter_resume',
      transcriptUtterances: [],
      soapNote: encounter.soapNote || {},
      metadata: {},
    });
    const saved = await this.sessionRepository.save(session);

    // Write the session id back to the encounter for fast reverse lookup
    await this.encounterService.update(
      encounterId,
      { documentationSessionId: saved.id } as any,
      tenantId,
    );

    await this.audit(actor, tenantId, saved.id, 'DOCUMENTATION_SESSION_RESUMED_OR_CREATED', { encounterId });
    return saved;
  }

  /**
   * Paginated list of documentation sessions for a tenant with optional filters.
   */
  async listForTenant(
    tenantId: string,
    filters: DocumentationSessionListFilters,
  ): Promise<{ data: DocumentationSession[]; total: number; page: number; limit: number }> {
    const page = filters.page || 1;
    const limit = filters.limit || 20;

    const qb = this.sessionRepository
      .createQueryBuilder('session')
      .where('session.tenantId = :tenantId', { tenantId });

    if (filters.patientId) qb.andWhere('session.patientId = :patientId', { patientId: filters.patientId });
    if (filters.providerId) qb.andWhere('session.providerId = :providerId', { providerId: filters.providerId });
    if (filters.status) qb.andWhere('session.status = :status', { status: filters.status });
    if (filters.encounterId) qb.andWhere('session.encounterId = :encounterId', { encounterId: filters.encounterId });

    qb.orderBy('session.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  /**
   * Fetch a session plus all intelligence data (evidence, quality, action drafts,
   * payer prompts) in a single call to avoid N round-trips from the frontend.
   */
  async getWithIntelligence(
    tenantId: string,
    sessionId: string,
  ): Promise<DocumentationIntelligenceBundle> {
    const session = await this.findOne(tenantId, sessionId);

    const [evidence, quality, actionDrafts, payerPrompts] = await Promise.all([
      this.intelligenceService.getEvidence(tenantId, sessionId),
      this.intelligenceService.qualityCheck(tenantId, sessionId),
      this.actionsService.list(tenantId, sessionId),
      this.collectPayerPrompts(tenantId, session.patientId),
    ]);

    return { session, evidence, quality, actionDrafts, payerPrompts };
  }

  /**
   * Sync SOAP note from the encounter editor back to the documentation session.
   * Called when EncounterService.update receives a soapNote change and the
   * encounter has a linked documentationSessionId. Creates a CLINICIAN_EDITED
   * version if the SOAP actually changed and the session is still editable.
   */
  async syncFromEncounter(
    tenantId: string,
    sessionId: string,
    soapNote: DocumentationSoapNote,
  ): Promise<void> {
    const session = await this.sessionRepository.findOne({ where: { id: sessionId, tenantId } });
    if (!session) return;
    if (
      session.status === DocumentationSessionStatus.SIGNED ||
      session.status === DocumentationSessionStatus.CANCELLED
    ) {
      return;
    }
    const changed = JSON.stringify(session.soapNote) !== JSON.stringify(soapNote);
    if (!changed) return;

    session.soapNote = soapNote;
    await this.sessionRepository.save(session);
    await this.createVersion(session, DocumentationNoteVersionSource.CLINICIAN_EDITED, 'system');
  }

  /**
   * Collect payer-specific denial/underpayment risk prompts for a patient's
   * active insurance policies. Queries PatientInsurance (with eager InsurancePayer),
   * extracts unique payer names, and calls DocumentationRevenueService.payerRisk
   * for each.
   */
  private async collectPayerPrompts(
    tenantId: string,
    patientId: string,
  ): Promise<DocumentationIntelligenceBundle['payerPrompts']> {
    const insurances = await this.patientInsuranceRepository.find({
      where: { tenantId, patientId },
      relations: ['payer'],
    });

    const payerNames = [...new Set(
      insurances
        .map((i) => i.payer?.name)
        .filter((name): name is string => Boolean(name)),
    )];

    if (!payerNames.length) return [];

    const results = await Promise.all(
      payerNames.map((payerName) => this.revenueService.payerRisk(tenantId, payerName)),
    );

    return results;
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

  /**
   * Build chart context string from encounter data for AI prompt enrichment.
   * (Roadmap #2: chart-context-aware note generation)
   * Includes: chief complaint, vitals, active diagnoses, medications, allergies, orders, existing SOAP.
   * Only includes fields that are present — avoids cluttering the prompt with empty data.
   */
  private buildChartContext(encounter: any): string {
    const parts: string[] = [];

    if (encounter.chiefComplaint) parts.push(`Chief complaint: ${encounter.chiefComplaint}`);

    // Vitals
    const v = encounter.vitals;
    if (v) {
      const vitals: string[] = [];
      if (v.bloodPressure) vitals.push(`BP ${v.bloodPressure}`);
      if (v.heartRate) vitals.push(`HR ${v.heartRate}`);
      if (v.temperature) vitals.push(`Temp ${v.temperature}${v.temperatureRoute ? ` (${v.temperatureRoute})` : ''}`);
      if (v.oxygenSaturation) vitals.push(`SpO2 ${v.oxygenSaturation}%`);
      if (v.respiratoryRate) vitals.push(`RR ${v.respiratoryRate}`);
      if (v.weight) vitals.push(`Weight ${v.weight} ${v.weightUnit || 'lbs'}`);
      if (v.height) vitals.push(`Height ${v.height} ${v.heightUnit || 'in'}`);
      if (v.bmi) vitals.push(`BMI ${v.bmi}`);
      if (v.painScore != null) vitals.push(`Pain ${v.painScore}/10${v.painLocation ? ` (${v.painLocation})` : ''}`);
      if (v.bloodGlucose) vitals.push(`Glucose ${v.bloodGlucose}${v.bloodGlucoseContext ? ` (${v.bloodGlucoseContext})` : ''}`);
      if (vitals.length) parts.push(`Vitals: ${vitals.join(', ')}`);
    }

    // Active diagnoses
    const activeDx = (encounter.diagnoses || []).filter((d: any) => d.status !== 'resolved' && d.status !== 'ruled_out' && d.status !== 'inactive');
    if (activeDx.length) {
      parts.push(`Active diagnoses: ${activeDx.map((d: any) => `${d.code} ${d.description}${d.isPrimary ? ' (primary)' : ''}`).join('; ')}`);
    }

    // Medications
    const meds = encounter.treatmentPlan?.medications;
    if (meds?.length) {
      parts.push(`Current medications: ${meds.map((m: any) => `${m.name} ${m.dosage} ${m.frequency}${m.route ? ` ${m.route}` : ''}`).join('; ')}`);
    }

    // Allergies
    const allergies = encounter.allergies || [];
    if (allergies.length) {
      parts.push(`Allergies: ${allergies.map((a: any) => `${a.allergen} (${a.severity.replace(/_/g, ' ')})`).join('; ')}`);
    }

    // Existing orders
    const orders = encounter.orders || {};
    const labOrders = orders.labs || [];
    const imagingOrders = orders.imaging || [];
    if (labOrders.length) parts.push(`Lab orders: ${labOrders.map((l: any) => l.name).join(', ')}`);
    if (imagingOrders.length) parts.push(`Imaging orders: ${imagingOrders.map((i: any) => i.name).join(', ')}`);

    // Existing SOAP (if any) — so the AI can refine rather than replace
    const soap = encounter.soapNote || {};
    const soapParts: string[] = [];
    if (soap.subjective) soapParts.push(`S: ${soap.subjective}`);
    if (soap.objective) soapParts.push(`O: ${soap.objective}`);
    if (soap.assessment) soapParts.push(`A: ${soap.assessment}`);
    if (soap.plan) soapParts.push(`P: ${soap.plan}`);
    if (soapParts.length) parts.push(`Existing SOAP note:\n${soapParts.join('\n')}`);

    if (!parts.length) return '';
    return `Chart context (use for organization only — do not add findings not in transcript):\n${parts.join('\n')}`;
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
