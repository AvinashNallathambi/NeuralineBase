import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Not, In, IsNull, LessThan, MoreThan } from 'typeorm';
import {
  PriorAuthRequest,
  PriorAuthStatus,
  PriorAuthBenefitType,
  PriorAuthUrgency,
  PriorAuthSubmissionMethod,
} from './entities/prior-auth-request.entity';
import { PriorAuthRequirement } from './entities/prior-auth-requirement.entity';
import { PriorAuthAttachment } from './entities/prior-auth-attachment.entity';
import { PriorAuthAiService } from './prior-auth-ai.service';
import { SuperbillsService } from '../superbills/superbills.service';
import {
  SEED_REQUIREMENTS,
  lookupRequirement,
} from './prior-auth-requirement-registry';
import {
  CreatePriorAuthRequestDto,
  UpdatePriorAuthRequestDto,
  SubmitPriorAuthDto,
  PayerResponseDto,
  AssignPriorAuthDto,
  CreateAttachmentDto,
  CheckRequirementDto,
  AutoTriggerPaDto,
} from './dto/prior-auth.dto';

@Injectable()
export class PriorAuthService {
  private readonly logger = new Logger(PriorAuthService.name);

  constructor(
    @InjectRepository(PriorAuthRequest)
    private readonly paRepository: Repository<PriorAuthRequest>,
    @InjectRepository(PriorAuthRequirement)
    private readonly requirementRepository: Repository<PriorAuthRequirement>,
    @InjectRepository(PriorAuthAttachment)
    private readonly attachmentRepository: Repository<PriorAuthAttachment>,
    private readonly paAiService: PriorAuthAiService,
    private readonly superbillsService: SuperbillsService,
    private readonly dataSource: DataSource,
  ) {}

  // ═══════════════════════════════════════════════════════════════════
  // P0: CRUD
  // ═══════════════════════════════════════════════════════════════════

  async create(tenantId: string, dto: CreatePriorAuthRequestDto, createdBy?: string): Promise<PriorAuthRequest> {
    const pa = new PriorAuthRequest();
    pa.tenantId = tenantId;
    pa.patientId = dto.patientId;
    pa.patientName = dto.patientName ?? null;
    pa.encounterId = dto.encounterId ?? null;
    pa.superbillId = dto.superbillId ?? null;
    pa.providerId = dto.providerId ?? null;
    pa.providerName = dto.providerName ?? null;
    pa.benefitType = dto.benefitType ?? PriorAuthBenefitType.MEDICAL;
    pa.status = PriorAuthStatus.DRAFT;
    pa.urgency = dto.urgency ?? PriorAuthUrgency.STANDARD;
    pa.payerName = dto.payerName ?? null;
    pa.payerId = dto.payerId ?? null;
    pa.planName = dto.planName ?? null;
    pa.policyNumber = dto.policyNumber ?? null;
    pa.groupNumber = dto.groupNumber ?? null;
    pa.eligibilityVerificationId = dto.eligibilityVerificationId ?? null;
    pa.procedureCodes = dto.procedureCodes;
    pa.diagnosisCodes = dto.diagnosisCodes ?? [];
    pa.clinicalNotes = dto.clinicalNotes ?? null;
    pa.serviceDate = dto.serviceDate ? new Date(dto.serviceDate) : null;
    pa.estimatedCost = dto.estimatedCost ?? null;
    pa.assignedTo = dto.assignedTo ?? null;
    pa.priority = dto.priority ?? 3;
    pa.autoTriggered = dto.autoTriggered ?? false;
    pa.autoTriggerSource = dto.autoTriggerSource ?? null;
    pa.notes = dto.notes ?? null;
    pa.version = 1;
    pa.visitsUsed = 0;

    // Calculate due date based on urgency
    if (pa.urgency === PriorAuthUrgency.EXPEDITED) {
      pa.dueDate = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours
    } else {
      pa.dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    }

    const saved = await this.paRepository.save(pa);
    this.logger.log(`PA created: ${saved.id} for patient ${dto.patientId}, payer: ${dto.payerName}`);
    return saved;
  }

  async findOne(tenantId: string, id: string): Promise<PriorAuthRequest> {
    const pa = await this.paRepository.findOne({
      where: { id, tenantId },
    });
    if (!pa) throw new NotFoundException(`Prior auth request ${id} not found`);
    return pa;
  }

  async findByPatient(tenantId: string, patientId: string): Promise<PriorAuthRequest[]> {
    return this.paRepository.find({
      where: { tenantId, patientId, status: Not(In([PriorAuthStatus.SUPERSEDED, PriorAuthStatus.CANCELLED])) },
      order: { createdAt: 'DESC' },
    });
  }

  async findByStatus(tenantId: string, status: PriorAuthStatus): Promise<PriorAuthRequest[]> {
    return this.paRepository.find({
      where: { tenantId, status },
      order: { priority: 'ASC', dueDate: 'ASC' },
    });
  }

  async list(tenantId: string, filters?: {
    patientId?: string;
    status?: PriorAuthStatus;
    payerName?: string;
    assignedTo?: string;
  }): Promise<PriorAuthRequest[]> {
    const where: any = { tenantId };
    if (filters?.patientId) where.patientId = filters.patientId;
    if (filters?.status) where.status = filters.status;
    if (filters?.payerName) where.payerName = filters.payerName;
    if (filters?.assignedTo) where.assignedTo = filters.assignedTo;
    return this.paRepository.find({
      where,
      order: { priority: 'ASC', dueDate: 'ASC', createdAt: 'DESC' },
    });
  }

  async update(tenantId: string, id: string, dto: UpdatePriorAuthRequestDto): Promise<PriorAuthRequest> {
    const pa = await this.findOne(tenantId, id);

    // Prevent editing of submitted/approved PAs (must create new version)
    if ([PriorAuthStatus.SUBMITTED, PriorAuthStatus.PENDING, PriorAuthStatus.APPROVED].includes(pa.status)) {
      throw new BadRequestException(`Cannot edit PA in ${pa.status} status — create a new version instead`);
    }

    Object.assign(pa, dto);
    if (dto.serviceDate) pa.serviceDate = new Date(dto.serviceDate);
    if (dto.procedureCodes) pa.procedureCodes = dto.procedureCodes;
    if (dto.diagnosisCodes) pa.diagnosisCodes = dto.diagnosisCodes;

    return this.paRepository.save(pa);
  }

  // ═══════════════════════════════════════════════════════════════════
  // P0: Lifecycle — Submit, Payer Response, Re-auth
  // ═══════════════════════════════════════════════════════════════════

  async submit(tenantId: string, id: string, dto: SubmitPriorAuthDto, submittedBy: string): Promise<PriorAuthRequest> {
    const pa = await this.findOne(tenantId, id);

    if (pa.status !== PriorAuthStatus.DRAFT) {
      throw new BadRequestException(`PA must be in draft status to submit (current: ${pa.status})`);
    }

    pa.status = PriorAuthStatus.SUBMITTED;
    pa.submissionMethod = dto.submissionMethod;
    pa.submittedAt = new Date();
    pa.submittedBy = submittedBy;
    if (dto.authLetter) pa.authLetter = dto.authLetter;

    // Auto-transition to pending after submission
    const saved = await this.paRepository.save(pa);

    // In a real implementation, this is where X12 278 / FHIR PAS submission would happen
    // For now, we transition to pending immediately
    saved.status = PriorAuthStatus.PENDING;
    const finalSaved = await this.paRepository.save(saved);

    this.logger.log(`PA ${id} submitted via ${dto.submissionMethod} by ${submittedBy}`);
    return finalSaved;
  }

  async recordPayerResponse(tenantId: string, id: string, dto: PayerResponseDto): Promise<PriorAuthRequest> {
    const pa = await this.findOne(tenantId, id);

    if (![PriorAuthStatus.PENDING, PriorAuthStatus.SUBMITTED, PriorAuthStatus.P2P_SCHEDULED].includes(pa.status)) {
      throw new BadRequestException(`Cannot record payer response for PA in ${pa.status} status`);
    }

    pa.payerResponseAt = new Date();
    pa.payerDecisionNotes = dto.payerDecisionNotes ?? null;

    switch (dto.status) {
      case 'approved':
        pa.status = PriorAuthStatus.APPROVED;
        pa.authNumber = dto.authNumber ?? null;
        pa.approvedStartDate = dto.approvedStartDate ? new Date(dto.approvedStartDate) : null;
        pa.approvedEndDate = dto.approvedEndDate ? new Date(dto.approvedEndDate) : null;
        pa.expirationDate = dto.approvedEndDate ? new Date(dto.approvedEndDate) : pa.approvedEndDate;
        pa.visitCountApproved = dto.visitCountApproved ?? null;

        // Auto-attach auth number to superbill Box 23 if linked
        if (pa.superbillId && pa.authNumber) {
          await this.attachAuthNumberToSuperbill(pa.superbillId, pa.authNumber);
        }
        break;

      case 'denied':
        pa.status = PriorAuthStatus.DENIED;
        pa.denialReason = dto.denialReason ?? null;
        pa.denialCode = dto.denialCode ?? null;
        break;

      case 'p2p_scheduled':
        pa.status = PriorAuthStatus.P2P_SCHEDULED;
        pa.p2pScheduledAt = dto.p2pScheduledAt ? new Date(dto.p2pScheduledAt) : null;
        break;

      case 'pending':
        // Still pending — just update notes
        break;
    }

    const saved = await this.paRepository.save(pa);
    this.logger.log(`PA ${id} payer response: ${dto.status}`);
    return saved;
  }

  async cancel(tenantId: string, id: string, reason?: string): Promise<PriorAuthRequest> {
    const pa = await this.findOne(tenantId, id);
    pa.status = PriorAuthStatus.CANCELLED;
    pa.notes = reason ? `${pa.notes ?? ''}\n\nCancelled: ${reason}`.trim() : pa.notes;
    return this.paRepository.save(pa);
  }

  async createNewVersion(tenantId: string, id: string): Promise<PriorAuthRequest> {
    const original = await this.findOne(tenantId, id);

    // Supersede the original
    original.status = PriorAuthStatus.SUPERSEDED;
    await this.paRepository.save(original);

    // Create new version
    const newPa = new PriorAuthRequest();
    Object.assign(newPa, {
      ...original,
      id: undefined,
      status: PriorAuthStatus.DRAFT,
      version: original.version + 1,
      submittedAt: null,
      submittedBy: null,
      authNumber: null,
      payerResponseAt: null,
      payerDecisionNotes: null,
      denialReason: null,
      denialCode: null,
      approvedStartDate: null,
      approvedEndDate: null,
      expirationDate: null,
      visitCountApproved: null,
      visitsUsed: 0,
      p2pScheduledAt: null,
      p2pNotes: null,
      supersededById: null,
      aiRequirementPrediction: null,
      aiApprovalPrediction: null,
      aiExpirationPrediction: null,
      createdAt: undefined,
      updatedAt: undefined,
      deletedAt: undefined,
    });
    newPa.supersededById = null; // The new version is not superseded

    const saved = await this.paRepository.save(newPa);

    // Link original to new version
    original.supersededById = saved.id;
    await this.paRepository.save(original);

    this.logger.log(`PA ${id} superseded by new version ${saved.id} (v${saved.version})`);
    return saved;
  }

  // ═══════════════════════════════════════════════════════════════════
  // P0: Worklist
  // ═══════════════════════════════════════════════════════════════════

  async getWorklist(tenantId: string, filters?: {
    status?: PriorAuthStatus;
    assignedTo?: string;
    payerName?: string;
    priority?: number;
  }): Promise<PriorAuthRequest[]> {
    return this.list(tenantId, filters);
  }

  async assign(tenantId: string, id: string, dto: AssignPriorAuthDto): Promise<PriorAuthRequest> {
    const pa = await this.findOne(tenantId, id);
    pa.assignedTo = dto.assignedTo;
    return this.paRepository.save(pa);
  }

  async setPriority(tenantId: string, id: string, priority: number): Promise<PriorAuthRequest> {
    const pa = await this.findOne(tenantId, id);
    pa.priority = priority;
    return this.paRepository.save(pa);
  }

  // ═══════════════════════════════════════════════════════════════════
  // P0: Dashboard
  // ═══════════════════════════════════════════════════════════════════

  async getDashboard(tenantId: string): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byPayer: Array<{ payer: string; count: number; approvalRate: number }>;
    pendingCount: number;
    approvedCount: number;
    deniedCount: number;
    expiringSoon: number;
    expired: number;
    avgTurnaroundHours: number;
    autoTriggeredCount: number;
    topDeniedReasons: Array<{ reason: string; count: number }>;
  }> {
    const all = await this.paRepository.find({ where: { tenantId } });

    const byStatus: Record<string, number> = {};
    for (const pa of all) {
      byStatus[pa.status] = (byStatus[pa.status] ?? 0) + 1;
    }

    // Group by payer
    const payerMap = new Map<string, { count: number; approved: number; denied: number }>();
    for (const pa of all) {
      if (!pa.payerName) continue;
      const entry = payerMap.get(pa.payerName) ?? { count: 0, approved: 0, denied: 0 };
      entry.count++;
      if (pa.status === PriorAuthStatus.APPROVED) entry.approved++;
      if (pa.status === PriorAuthStatus.DENIED) entry.denied++;
      payerMap.set(pa.payerName, entry);
    }

    const byPayer = Array.from(payerMap.entries()).map(([payer, data]) => ({
      payer,
      count: data.count,
      approvalRate: data.approved + data.denied > 0
        ? Math.round((data.approved / (data.approved + data.denied)) * 100)
        : 0,
    }));

    // Expiring soon (within 7 days) and expired
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const expiringSoon = all.filter(
      (pa) => pa.expirationDate && pa.status === PriorAuthStatus.APPROVED &&
        new Date(pa.expirationDate) > now && new Date(pa.expirationDate) <= sevenDaysFromNow,
    ).length;
    const expired = all.filter(
      (pa) => pa.expirationDate && pa.status === PriorAuthStatus.APPROVED && new Date(pa.expirationDate) < now,
    ).length;

    // Average turnaround (submitted → payer response)
    const completed = all.filter((pa) => pa.submittedAt && pa.payerResponseAt);
    const avgTurnaroundHours = completed.length > 0
      ? Math.round(
          completed.reduce((sum, pa) => {
            const diff = new Date(pa.payerResponseAt!).getTime() - new Date(pa.submittedAt!).getTime();
            return sum + diff / (1000 * 60 * 60);
          }, 0) / completed.length,
        )
      : 0;

    // Top denial reasons
    const denialReasonMap = new Map<string, number>();
    for (const pa of all) {
      if (pa.status === PriorAuthStatus.DENIED && pa.denialReason) {
        denialReasonMap.set(pa.denialReason, (denialReasonMap.get(pa.denialReason) ?? 0) + 1);
      }
    }
    const topDeniedReasons = Array.from(denialReasonMap.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      total: all.length,
      byStatus,
      byPayer,
      pendingCount: byStatus[PriorAuthStatus.PENDING] ?? 0,
      approvedCount: byStatus[PriorAuthStatus.APPROVED] ?? 0,
      deniedCount: byStatus[PriorAuthStatus.DENIED] ?? 0,
      expiringSoon,
      expired,
      avgTurnaroundHours,
      autoTriggeredCount: all.filter((pa) => pa.autoTriggered).length,
      topDeniedReasons,
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // P0: Attachments
  // ═══════════════════════════════════════════════════════════════════

  async addAttachment(tenantId: string, paId: string, dto: CreateAttachmentDto): Promise<PriorAuthAttachment> {
    const pa = await this.findOne(tenantId, paId);
    const attachment = new PriorAuthAttachment();
    attachment.tenantId = tenantId;
    attachment.priorAuthRequestId = paId;
    attachment.patientId = pa.patientId;
    attachment.attachmentType = dto.attachmentType;
    attachment.title = dto.title;
    attachment.description = dto.description ?? null;
    attachment.content = dto.content ?? null;
    attachment.fileUrl = dto.fileUrl ?? null;
    attachment.fileName = dto.fileName ?? null;
    attachment.mimeType = dto.mimeType ?? null;
    attachment.evidenceDate = dto.evidenceDate ? new Date(dto.evidenceDate) : null;
    attachment.isAiGenerated = dto.isAiGenerated ?? false;
    attachment.satisfiesCriterion = dto.satisfiesCriterion ?? null;
    return this.attachmentRepository.save(attachment);
  }

  async getAttachments(tenantId: string, paId: string): Promise<PriorAuthAttachment[]> {
    return this.attachmentRepository.find({
      where: { tenantId, priorAuthRequestId: paId },
      order: { createdAt: 'DESC' },
    });
  }

  async deleteAttachment(tenantId: string, attachmentId: string): Promise<void> {
    const attachment = await this.attachmentRepository.findOne({ where: { id: attachmentId, tenantId } });
    if (!attachment) throw new NotFoundException(`Attachment ${attachmentId} not found`);
    await this.attachmentRepository.remove(attachment);
  }

  // ═══════════════════════════════════════════════════════════════════
  // P0: Requirement Lookup
  // ═══════════════════════════════════════════════════════════════════

  async checkRequirement(tenantId: string, dto: CheckRequirementDto): Promise<Array<{
    procedureCode: string;
    requirementType: string;
    isRequired: boolean;
    rule: any | null;
    aiPrediction: any | null;
  }>> {
    const results = [];
    for (const cpt of dto.procedureCodes) {
      const rule = lookupRequirement(dto.payerName, cpt);

      // If rule is ambiguous, use AI predictor
      let aiPrediction = null;
      if (!rule || rule.requirementType === 'conditional') {
        aiPrediction = await this.paAiService.predictRequirement(
          dto.payerName,
          [cpt],
          dto.diagnosisCodes ?? [],
        );
      }

      const isRequired =
        rule?.requirementType === 'always' ||
        (rule?.requirementType === 'conditional' && (aiPrediction?.isRequired ?? true)) ||
        (!rule && (aiPrediction?.isRequired ?? true));

      results.push({
        procedureCode: cpt,
        requirementType: rule?.requirementType ?? 'unknown',
        isRequired,
        rule,
        aiPrediction,
      });
    }
    return results;
  }

  // ═══════════════════════════════════════════════════════════════════
  // P0: Requirement Registry Management
  // ═══════════════════════════════════════════════════════════════════

  async getRequirements(tenantId: string, payerName?: string): Promise<PriorAuthRequirement[]> {
    const where: any = { tenantId, isActive: true };
    if (payerName) where.payerName = payerName;
    return this.requirementRepository.find({ where, order: { payerName: 'ASC', procedureCode: 'ASC' } });
  }

  async seedRequirements(tenantId: string): Promise<{ seeded: number }> {
    // Check if already seeded
    const existing = await this.requirementRepository.count({ where: { tenantId } });
    if (existing > 0) {
      return { seeded: 0 };
    }

    const requirements: PriorAuthRequirement[] = SEED_REQUIREMENTS.map((seed) => {
      const req = new PriorAuthRequirement();
      req.tenantId = tenantId;
      req.payerName = seed.payerName;
      req.procedureCode = seed.procedureCode;
      req.procedureDescription = seed.procedureDescription;
      req.requirementType = seed.requirementType;
      req.conditions = seed.conditions ?? [];
      req.requiredCriteria = seed.requiredCriteria;
      req.typicalTurnaroundHours = seed.typicalTurnaroundHours ?? null;
      req.typicalValidityDays = seed.typicalValidityDays ?? null;
      req.submissionMethods = seed.submissionMethods ?? ['electronic'];
      req.isAiGenerated = false;
      req.isActive = true;
      req.source = 'seed_registry';
      return req;
    });

    await this.requirementRepository.save(requirements);
    this.logger.log(`Seeded ${requirements.length} PA requirements for tenant ${tenantId}`);
    return { seeded: requirements.length };
  }

  // ═══════════════════════════════════════════════════════════════════
  // P1: AI Features — A1, A2, A4, A6
  // ═══════════════════════════════════════════════════════════════════

  /**
   * A1: Predict PA requirement and persist the prediction on the request.
   */
  async runRequirementPrediction(tenantId: string, id: string): Promise<PriorAuthRequest> {
    const pa = await this.findOne(tenantId, id);
    const prediction = await this.paAiService.predictRequirement(
      pa.payerName ?? 'Unknown',
      pa.procedureCodes.map((p) => p.code),
      pa.diagnosisCodes.map((d) => d.code),
    );
    pa.aiRequirementPrediction = prediction;
    return this.paRepository.save(pa);
  }

  /**
   * A2: Auto-trigger PA at order entry — check requirements and auto-draft.
   */
  async autoTriggerPa(tenantId: string, dto: AutoTriggerPaDto, createdBy?: string) {
    const result = await this.paAiService.autoTriggerPa(
      dto.patientId,
      dto.payerName ?? 'Unknown',
      dto.procedureCodes,
      dto.diagnosisCodes ?? [],
      dto.clinicalNotes,
    );

    if (!result.triggered || !result.draftRequest) {
      return result;
    }

    // Persist the auto-drafted PA request
    const pa = new PriorAuthRequest();
    pa.tenantId = tenantId;
    pa.patientId = dto.patientId;
    pa.patientName = result.draftRequest.patientName ?? null;
    pa.encounterId = dto.encounterId ?? null;
    pa.benefitType = result.draftRequest.benefitType ?? PriorAuthBenefitType.MEDICAL;
    pa.status = PriorAuthStatus.DRAFT;
    pa.urgency = result.draftRequest.urgency ?? PriorAuthUrgency.STANDARD;
    pa.payerName = dto.payerName ?? null;
    pa.procedureCodes = dto.procedureCodes;
    pa.diagnosisCodes = dto.diagnosisCodes ?? [];
    pa.clinicalNotes = dto.clinicalNotes ?? null;
    pa.serviceDate = dto.serviceDate ? new Date(dto.serviceDate) : null;
    pa.autoTriggered = true;
    pa.autoTriggerSource = 'order_entry';
    pa.authLetter = result.authLetter;
    pa.version = 1;
    pa.visitsUsed = 0;
    pa.priority = 2; // Auto-triggered PAs get elevated priority
    pa.dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const saved = await this.paRepository.save(pa);
    this.logger.log(`Auto-triggered PA ${saved.id} for patient ${dto.patientId}`);

    return {
      ...result,
      createdRequestId: saved.id,
    };
  }

  /**
   * A4: Predict approval probability and persist on the request.
   */
  async runApprovalPrediction(tenantId: string, id: string): Promise<PriorAuthRequest> {
    const pa = await this.findOne(tenantId, id);
    const prediction = await this.paAiService.predictApprovalProbability(pa);
    pa.aiApprovalPrediction = prediction;
    return this.paRepository.save(pa);
  }

  /**
   * A6: Predict expiration and persist on the request.
   */
  async runExpirationPrediction(tenantId: string, id: string): Promise<PriorAuthRequest> {
    const pa = await this.findOne(tenantId, id);
    const prediction = await this.paAiService.predictExpiration(pa);
    pa.aiExpirationPrediction = prediction;
    // If predicted expiration is earlier than known, update
    if (prediction.predictedExpiration && !pa.expirationDate) {
      pa.expirationDate = new Date(prediction.predictedExpiration);
    }
    return this.paRepository.save(pa);
  }

  /**
   * A3: Auto-assemble clinical evidence from chart data.
   */
  async assembleEvidence(
    tenantId: string,
    id: string,
    chartData: any,
  ) {
    const pa = await this.findOne(tenantId, id);
    const requiredCriteria = pa.procedureCodes.flatMap((p) => {
      const rule = lookupRequirement(pa.payerName ?? '', p.code);
      return rule?.requiredCriteria ?? [];
    });

    const result = await this.paAiService.assembleClinicalEvidence(pa, chartData, requiredCriteria);

    // Persist the evidence summary on the PA
    pa.clinicalEvidence = result.evidence;
    await this.paRepository.save(pa);

    // Create attachment records for assembled evidence
    for (const att of result.attachments) {
      await this.addAttachment(tenantId, id, {
        attachmentType: att.attachmentType,
        title: att.title,
        content: att.content,
        satisfiesCriterion: att.satisfiesCriterion,
        isAiGenerated: true,
      });
    }

    return result;
  }

  /**
   * A5: Prepare P2P review coaching.
   */
  async prepareP2P(tenantId: string, id: string) {
    const pa = await this.findOne(tenantId, id);
    if (pa.status !== PriorAuthStatus.DENIED && pa.status !== PriorAuthStatus.P2P_SCHEDULED) {
      throw new BadRequestException('P2P prep is only available for denied or P2P-scheduled PAs');
    }
    return this.paAiService.prepareP2PReview(pa, pa.denialReason ?? 'Unknown');
  }

  /**
   * A7: Learn from denial and optionally update requirement registry.
   */
  async learnFromDenial(tenantId: string, id: string) {
    const pa = await this.findOne(tenantId, id);
    if (pa.status !== PriorAuthStatus.DENIED) {
      throw new BadRequestException('Denial learning is only available for denied PAs');
    }
    const result = await this.paAiService.learnFromDenial(pa, pa.denialReason ?? 'Unknown');

    // If AI suggests a registry update, create/update a requirement rule
    if (result.registryUpdate) {
      const existing = await this.requirementRepository.findOne({
        where: {
          tenantId,
          payerName: result.registryUpdate.payerName,
          procedureCode: result.registryUpdate.procedureCode,
        },
      });

      if (existing) {
        // Merge new criteria
        const currentCriteria = existing.requiredCriteria.map((c) => c.criterion);
        const newCriteria = result.registryUpdate.newCriteria.filter((c) => !currentCriteria.includes(c));
        existing.requiredCriteria = [
          ...existing.requiredCriteria,
          ...newCriteria.map((criterion) => ({
            criterion,
            description: `Learned from denial on ${new Date().toISOString().split('T')[0]}`,
            documentationRequired: true,
          })),
        ];
        existing.isAiGenerated = true;
        existing.source = 'ai_denial_learning';
        await this.requirementRepository.save(existing);
      } else {
        // Create new AI-learned requirement
        const req = new PriorAuthRequirement();
        req.tenantId = tenantId;
        req.payerName = result.registryUpdate.payerName;
        req.procedureCode = result.registryUpdate.procedureCode;
        req.procedureDescription = pa.procedureCodes.find((p) => p.code === result.registryUpdate!.procedureCode)?.description ?? null;
        req.requirementType = 'always';
        req.conditions = [];
        req.requiredCriteria = result.registryUpdate.newCriteria.map((criterion) => ({
          criterion,
          description: `Learned from denial on ${new Date().toISOString().split('T')[0]}`,
          documentationRequired: true,
        }));
        req.submissionMethods = ['electronic'];
        req.isAiGenerated = true;
        req.isActive = true;
        req.source = 'ai_denial_learning';
        await this.requirementRepository.save(req);
      }
      this.logger.log(`Registry updated from denial learning: ${result.registryUpdate.payerName} × ${result.registryUpdate.procedureCode}`);
    }

    return result;
  }

  // ═══════════════════════════════════════════════════════════════════
  // P0: Box 23 Auto-Attach
  // ═══════════════════════════════════════════════════════════════════

  async attachAuthNumberToSuperbill(superbillId: string, authNumber: string): Promise<void> {
    try {
      const superbill = await this.superbillsService.findOne(superbillId);
      superbill.priorAuthNumber = authNumber;
      // Save directly via repository — SuperbillsService.update() blocks non-draft status
      // but we need to attach the auth number even after submission
      await this.dataSource.getRepository('Superbill').save(superbill);
      this.logger.log(`Auth number ${authNumber} attached to superbill ${superbillId} (Box 23)`);
    } catch (err: any) {
      this.logger.error(`Failed to attach auth number to superbill ${superbillId}: ${err.message}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // P0: Expiration Check (can be called by a cron job)
  // ═══════════════════════════════════════════════════════════════════

  async checkExpirations(tenantId: string): Promise<{ expired: number; expiringSoon: number }> {
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Mark expired PAs
    const approvedPas = await this.paRepository.find({
      where: { tenantId, status: PriorAuthStatus.APPROVED },
    });

    let expired = 0;
    let expiringSoon = 0;

    for (const pa of approvedPas) {
      if (!pa.expirationDate) continue;
      const expDate = new Date(pa.expirationDate);
      if (expDate < now) {
        pa.status = PriorAuthStatus.EXPIRED;
        await this.paRepository.save(pa);
        expired++;
      } else if (expDate <= sevenDaysFromNow) {
        expiringSoon++;
      }
    }

    return { expired, expiringSoon };
  }
}
