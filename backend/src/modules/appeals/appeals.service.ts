import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Appeal, AppealType, AppealStatus, AppealOutcome } from './entities/appeal.entity';
import { AppealStatusHistory } from './entities/appeal-status-history.entity';
import { AppealAiService, AppealGenerationInput } from './appeal-ai.service';
import { DenialRecord, DenialWorklistStatus } from '../denials/entities/denial-record.entity';
import { EncounterClaim } from '../billing/entities/encounter-claim.entity';
import { ClaimLineItem } from '../billing/entities/claim-line-item.entity';

@Injectable()
export class AppealsService {
  private readonly logger = new Logger(AppealsService.name);

  constructor(
    @InjectRepository(Appeal)
    private readonly appealRepository: Repository<Appeal>,
    @InjectRepository(AppealStatusHistory)
    private readonly historyRepository: Repository<AppealStatusHistory>,
    @InjectRepository(DenialRecord)
    private readonly denialRepository: Repository<DenialRecord>,
    @InjectRepository(EncounterClaim)
    private readonly claimRepository: Repository<EncounterClaim>,
    @InjectRepository(ClaimLineItem)
    private readonly lineItemRepository: Repository<ClaimLineItem>,
    private readonly appealAiService: AppealAiService,
  ) {}

  // ─── Create Appeal from Denial ─────────────────────────────────────

  async createFromDenial(denialId: string, tenantId: string): Promise<Appeal> {
    const denial = await this.denialRepository.findOne({ where: { id: denialId, tenantId } });
    if (!denial) throw new NotFoundException(`Denial ${denialId} not found`);

    // Get claim details
    let claim: EncounterClaim | null = null;
    let lineItems: ClaimLineItem[] = [];
    if (denial.claimId) {
      claim = await this.claimRepository.findOne({ where: { id: denial.claimId } });
      if (claim) {
        lineItems = await this.lineItemRepository.find({ where: { claimId: claim.id } });
      }
    }

    const appeal = new Appeal();
    appeal.tenantId = tenantId;
    appeal.denialId = denialId;
    appeal.claimId = denial.claimId || null;
    appeal.claimNumber = denial.claimNumber || claim?.claimNumber || null;
    appeal.appealNumber = this.generateAppealNumber();
    appeal.appealType = AppealType.FIRST_LEVEL;
    appeal.status = AppealStatus.DRAFT;
    appeal.outcome = AppealOutcome.PENDING;
    appeal.payerName = denial.payerName || null;
    appeal.patientName = denial.patientName || null;
    appeal.patientId = denial.patientId || null;
    appeal.carcCode = denial.carcCode;
    appeal.denialReason = denial.denialReasonText || denial.carcDescription;
    appeal.deniedAmount = denial.deniedAmount;
    appeal.deadlineDate = denial.filingDeadline || null;
    appeal.supportingDocuments = [];

    const saved = await this.appealRepository.save(appeal);

    // Update denial status to appealed
    denial.status = DenialWorklistStatus.APPEALED;
    await this.denialRepository.save(denial);

    // Create status history entry
    await this.addStatusHistory(saved.id, AppealStatus.DRAFT, null, null, 'Appeal created from denial');

    return saved;
  }

  // ─── AI Appeal Letter Generation ───────────────────────────────────

  async generateAppealLetter(appealId: string, tenantId: string): Promise<Appeal> {
    const appeal = await this.findOne(appealId);

    const denial = await this.denialRepository.findOne({ where: { id: appeal.denialId, tenantId } });
    if (!denial) throw new NotFoundException(`Denial for appeal ${appealId} not found`);

    let claim: EncounterClaim | null = null;
    let lineItems: ClaimLineItem[] = [];
    if (appeal.claimId) {
      claim = await this.claimRepository.findOne({ where: { id: appeal.claimId } });
      if (claim) {
        lineItems = await this.lineItemRepository.find({ where: { claimId: claim.id } });
      }
    }

    const input: AppealGenerationInput = {
      payerName: appeal.payerName || 'Insurance Payer',
      patientName: appeal.patientName || 'Patient',
      claimNumber: appeal.claimNumber || 'N/A',
      serviceDate: denial.serviceDate?.toISOString().split('T')[0] || claim?.serviceDate?.toString() || 'N/A',
      cptCodes: lineItems.map((l) => l.code).filter(Boolean),
      diagnosisCodes: lineItems.flatMap((l) => l.diagnosisPointer || []).filter(Boolean),
      deniedAmount: appeal.deniedAmount,
      carcCode: appeal.carcCode || denial.carcCode,
      carcDescription: denial.carcDescription || '',
      rarcCode: denial.rarcCode || undefined,
      rarcDescription: denial.rarcDescription || undefined,
      denialReasonText: appeal.denialReason || undefined,
      clinicalNotes: (claim?.notes as string) || undefined,
      providerName: claim?.providerName || 'Provider',
      providerNPI: claim?.providerNPI || 'N/A',
      facilityName: undefined,
    };

    const result = await this.appealAiService.generateAppealLetter(input);

    appeal.appealSubject = result.subject;
    appeal.appealLetter = result.letter;
    appeal.successProbability = result.successProbability;
    appeal.aiRationale = result.rationale;
    appeal.metadata = {
      ...appeal.metadata,
      keyArguments: result.keyArguments,
      recommendedDocuments: result.recommendedDocuments,
    };

    return this.appealRepository.save(appeal);
  }

  // ─── AI Success Prediction ────────────────────────────────────────

  async predictSuccess(appealId: string): Promise<{ probability: number; rationale: string }> {
    const appeal = await this.findOne(appealId);
    const denial = await this.denialRepository.findOne({ where: { id: appeal.denialId } });
    if (!denial) throw new NotFoundException(`Denial not found`);

    const input: AppealGenerationInput = {
      payerName: appeal.payerName || 'Insurance Payer',
      patientName: appeal.patientName || 'Patient',
      claimNumber: appeal.claimNumber || 'N/A',
      serviceDate: denial.serviceDate?.toISOString() || 'N/A',
      cptCodes: denial.cptCode ? [denial.cptCode] : [],
      diagnosisCodes: [],
      deniedAmount: appeal.deniedAmount,
      carcCode: appeal.carcCode || denial.carcCode,
      carcDescription: denial.carcDescription || '',
      rarcCode: denial.rarcCode || undefined,
      rarcDescription: denial.rarcDescription || undefined,
      denialReasonText: appeal.denialReason || undefined,
      providerName: 'Provider',
      providerNPI: 'N/A',
    };

    return this.appealAiService.predictAppealSuccess(input);
  }

  // ─── Workflow ──────────────────────────────────────────────────────

  async submit(appealId: string, submittedBy: string, submittedByName: string): Promise<Appeal> {
    const appeal = await this.findOne(appealId);
    appeal.status = AppealStatus.SUBMITTED;
    appeal.submittedDate = new Date();
    appeal.submittedBy = submittedBy;
    appeal.submittedByName = submittedByName;
    await this.appealRepository.save(appeal);
    await this.addStatusHistory(appealId, AppealStatus.SUBMITTED, submittedBy, submittedByName, 'Appeal submitted to payer');
    return appeal;
  }

  async updateStatus(
    appealId: string,
    status: AppealStatus,
    outcome?: AppealOutcome,
    recoveredAmount?: number,
    notes?: string,
    changedBy?: string,
    changedByName?: string,
  ): Promise<Appeal> {
    const appeal = await this.findOne(appealId);
    appeal.status = status;
    if (outcome) appeal.outcome = outcome;
    if (recoveredAmount != null) appeal.recoveredAmount = recoveredAmount;
    if (notes) appeal.resolutionNotes = notes;
    if (status === AppealStatus.APPROVED || status === AppealStatus.DENIED || status === AppealStatus.PARTIALLY_APPROVED) {
      appeal.responseDate = new Date();
    }
    await this.appealRepository.save(appeal);
    await this.addStatusHistory(appealId, status, changedBy, changedByName, notes);

    // Update denial status based on appeal outcome
    if (status === AppealStatus.APPROVED) {
      await this.denialRepository.update(
        { id: appeal.denialId },
        { status: DenialWorklistStatus.RESOLVED, resolvedAt: new Date(), resolutionNotes: notes },
      );
    }

    return appeal;
  }

  // ─── Queries ───────────────────────────────────────────────────────

  async findAll(tenantId: string, status?: AppealStatus): Promise<Appeal[]> {
    const where: any = { tenantId };
    if (status) where.status = status;
    return this.appealRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Appeal> {
    const appeal = await this.appealRepository.findOne({
      where: { id },
      relations: ['statusHistory'],
    });
    if (!appeal) throw new NotFoundException(`Appeal ${id} not found`);
    return appeal;
  }

  async getStats(tenantId: string): Promise<{
    totalAppeals: number;
    pendingCount: number;
    submittedCount: number;
    approvedCount: number;
    deniedCount: number;
    totalRecovered: number;
    successRate: number;
    avgSuccessProbability: number;
  }> {
    const appeals = await this.appealRepository.find({ where: { tenantId } });
    const approved = appeals.filter((a) => a.status === AppealStatus.APPROVED);
    const totalRecovered = approved.reduce((sum, a) => sum + (a.recoveredAmount || 0), 0);
    const decided = appeals.filter(
      (a) => a.status === AppealStatus.APPROVED || a.status === AppealStatus.DENIED,
    );
    const withProb = appeals.filter((a) => a.successProbability != null);

    return {
      totalAppeals: appeals.length,
      pendingCount: appeals.filter((a) => a.status === AppealStatus.DRAFT).length,
      submittedCount: appeals.filter((a) => a.status === AppealStatus.SUBMITTED || a.status === AppealStatus.UNDER_REVIEW).length,
      approvedCount: approved.length,
      deniedCount: appeals.filter((a) => a.status === AppealStatus.DENIED).length,
      totalRecovered,
      successRate: decided.length > 0 ? (approved.length / decided.length) * 100 : 0,
      avgSuccessProbability:
        withProb.length > 0
          ? withProb.reduce((sum, a) => sum + (a.successProbability || 0), 0) / withProb.length
          : 0,
    };
  }

  // ─── Helpers ───────────────────────────────────────────────────────

  private async addStatusHistory(
    appealId: string,
    status: AppealStatus,
    changedBy?: string | null,
    changedByName?: string | null,
    notes?: string | null,
  ): Promise<void> {
    const history = new AppealStatusHistory();
    history.appeal = { id: appealId } as Appeal;
    history.status = status;
    history.changedBy = changedBy || null;
    history.changedByName = changedByName || null;
    history.notes = notes || null;
    await this.historyRepository.save(history);
  }

  private generateAppealNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `APL-${timestamp}-${random}`;
  }
}
