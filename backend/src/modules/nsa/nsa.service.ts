import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  GoodFaithEstimate,
  GfeStatus,
  GfeType,
  DeliveryMethod,
  VarianceStatus,
} from './entities/good-faith-estimate.entity';
import {
  NsaVarianceRecord,
  VarianceRecordStatus,
} from './entities/nsa-variance-record.entity';
import { NsaIdrCase, IdrCaseStatus, IdrJurisdiction } from './entities/nsa-idr-case.entity';
import {
  NsaIdrDeadline,
  DeadlineType,
  DeadlineStatus,
} from './entities/nsa-idr-deadline.entity';
import { BusinessDayCalculator } from './business-day-calculator.service';
import { NsaAiService } from './nsa-ai.service';
import { SuperbillsService } from '../superbills/superbills.service';
import { AiService } from '../ai/ai.service';
import {
  CreateGfeDto,
  GenerateGfeFromSuperbillDto,
  DeliverGfeDto,
  AcknowledgeGfeDto,
  UpdateGfeDto,
  CreateIdrCaseDto,
  UpdateIdrCaseDto,
} from './dto/nsa.dto';

const NSA_VARIANCE_THRESHOLD = 400; // $400 per CMS NSA rules

@Injectable()
export class NsaService {
  private readonly logger = new Logger(NsaService.name);

  constructor(
    @InjectRepository(GoodFaithEstimate)
    private readonly gfeRepository: Repository<GoodFaithEstimate>,
    @InjectRepository(NsaVarianceRecord)
    private readonly varianceRepository: Repository<NsaVarianceRecord>,
    @InjectRepository(NsaIdrCase)
    private readonly idrCaseRepository: Repository<NsaIdrCase>,
    @InjectRepository(NsaIdrDeadline)
    private readonly deadlineRepository: Repository<NsaIdrDeadline>,
    private readonly businessDayCalculator: BusinessDayCalculator,
    private readonly nsaAiService: NsaAiService,
    private readonly superbillsService: SuperbillsService,
    private readonly aiService: AiService,
    private readonly dataSource: DataSource,
  ) {}

  // ═══════════════════════════════════════════════════════════════════
  // P0: GFE CRUD + Persistence
  // ═══════════════════════════════════════════════════════════════════

  async createGfe(tenantId: string, dto: CreateGfeDto, createdBy?: string): Promise<GoodFaithEstimate> {
    const gfe = new GoodFaithEstimate();
    gfe.tenantId = tenantId;
    gfe.patientId = dto.patientId;
    gfe.patientName = dto.patientName;
    gfe.superbillId = dto.superbillId || null;
    gfe.encounterId = dto.encounterId || null;
    gfe.providerId = dto.providerId || null;
    gfe.providerName = dto.providerName || null;
    gfe.gfeType = dto.gfeType;
    gfe.status = GfeStatus.DRAFT;
    gfe.version = 1;
    gfe.serviceDate = new Date(dto.serviceDate);
    gfe.scheduledDate = dto.scheduledDate ? new Date(dto.scheduledDate) : null;
    gfe.totalCharge = dto.totalCharge;
    gfe.insuranceEstimate = dto.insuranceEstimate;
    gfe.patientEstimate = dto.patientEstimate;
    gfe.items = dto.items;
    gfe.disclaimers = dto.disclaimers || [];
    gfe.complianceNotes = dto.complianceNotes || [];
    gfe.notes = dto.notes || null;
    gfe.varianceStatus = VarianceStatus.NONE;
    gfe.isCompliant = false;

    // P0: Calculate delivery deadline (3 business days before service)
    gfe.deliveryDeadline = this.businessDayCalculator.calculateGfeDeliveryDeadline(
      gfe.serviceDate,
      gfe.scheduledDate || undefined,
    );

    const saved = await this.gfeRepository.save(gfe);
    this.logger.log(`GFE created: ${saved.id} for patient ${dto.patientId}, deadline: ${saved.deliveryDeadline?.toISOString()}`);
    return saved;
  }

  async generateGfeFromSuperbill(
    tenantId: string,
    dto: GenerateGfeFromSuperbillDto,
    createdBy?: string,
  ): Promise<GoodFaithEstimate> {
    this.logger.debug(`Generating GFE from superbill ${dto.superbillId}`);

    const superbill = await this.superbillsService.findOne(dto.superbillId);

    // Determine GFE type
    const gfeType = dto.gfeType || this.inferGfeType(superbill);

    // Build AI prompt (reuse existing logic from superbill-ai.controller but persist result)
    const prompt = this.buildGfePrompt(superbill, gfeType, dto.patientNotes);
    const gfeResult = await this.aiService.generateStructured<{
      totalCharge: number;
      insuranceEstimate: number;
      patientEstimate: number;
      items: Array<{ service: string; cptCode: string; charge: number; insuranceEstimate: number; patientEstimate: number }>;
      disclaimers: string[];
      complianceNotes: string[];
    }>(prompt);

    // Persist the GFE
    const gfe = new GoodFaithEstimate();
    gfe.tenantId = tenantId;
    gfe.patientId = superbill.patientId;
    gfe.patientName = superbill.patientName;
    gfe.superbillId = superbill.id;
    gfe.encounterId = superbill.encounterId || null;
    gfe.providerId = superbill.providerId;
    gfe.providerName = superbill.providerName;
    gfe.gfeType = gfeType;
    gfe.status = GfeStatus.DRAFT;
    gfe.version = 1;
    gfe.serviceDate = superbill.serviceDate;
    gfe.totalCharge = gfeResult.totalCharge;
    gfe.insuranceEstimate = gfeResult.insuranceEstimate;
    gfe.patientEstimate = gfeResult.patientEstimate;
    gfe.items = gfeResult.items;
    gfe.disclaimers = gfeResult.disclaimers;
    gfe.complianceNotes = gfeResult.complianceNotes;
    gfe.varianceStatus = VarianceStatus.NONE;
    gfe.isCompliant = false;
    gfe.deliveryDeadline = this.businessDayCalculator.calculateGfeDeliveryDeadline(superbill.serviceDate);

    const saved = await this.gfeRepository.save(gfe);
    this.logger.log(`GFE generated and persisted: ${saved.id} from superbill ${dto.superbillId}`);
    return saved;
  }

  private inferGfeType(superbill: any): GfeType {
    const insuranceProvider = superbill.insurance?.provider?.toLowerCase() || '';
    if (!insuranceProvider || insuranceProvider === 'self-pay' || insuranceProvider === 'none') {
      return GfeType.SELF_PAY;
    }
    return GfeType.INSURED_OON;
  }

  private buildGfePrompt(superbill: any, gfeType: GfeType, patientNotes?: string): string {
    const typeContext = gfeType === GfeType.SELF_PAY
      ? 'This is a SELF-PAY patient (no insurance). The GFE must include the full charge as the patient estimate.'
      : gfeType === GfeType.UNINSURED
        ? 'This is an UNINSURED patient. The GFE must include the full charge as the patient estimate.'
        : 'This is an OUT-OF-NETWORK insured patient. Estimate insurance and patient portions.';

    return `You are a healthcare pricing transparency specialist. Generate a Good Faith Estimate (GFE) compliant with the No Surprises Act for the following patient services.

${typeContext}

Superbill Data:
- Patient: ${superbill.patientName}, DOB: ${superbill.patientDOB}
- Service Date: ${superbill.serviceDate}
- Insurance: ${superbill.insurance?.provider || 'Self-Pay'}

Procedures & Charges:
${superbill.procedures?.map((p: any) => `- ${p.cptCode}: ${p.description}, Units: ${p.units}, Charge: $${p.charge}`).join('\n') || 'None'}

Additional Charges:
${superbill.charges?.map((c: any) => `- ${c.description}: $${c.amount} (${c.type})`).join('\n') || 'None'}

Total Amount: $${superbill.totalAmount}

${patientNotes ? `Patient Notes:\n${patientNotes}` : ''}

Return ONLY a JSON object with this exact shape:
{
  "totalCharge": number,
  "insuranceEstimate": number,
  "patientEstimate": number,
  "items": [
    {
      "service": "description",
      "cptCode": "code",
      "charge": number,
      "insuranceEstimate": number,
      "patientEstimate": number
    }
  ],
  "disclaimers": ["disclaimer 1", ...],
  "complianceNotes": ["compliance note 1", ...]
}

Rules:
- For self-pay/uninsured: insuranceEstimate = 0, patientEstimate = totalCharge.
- For insured OON: insurance estimate is typically 60-80% of charge, patient estimate 20-40%.
- Include standard No Surprises Act disclaimers.
- Include compliance notes about GFE requirements.
- Include patient dispute rights ($400 variance threshold).`;
  }

  async findOneGfe(tenantId: string, id: string): Promise<GoodFaithEstimate> {
    const gfe = await this.gfeRepository.findOne({ where: { id, tenantId } });
    if (!gfe) throw new NotFoundException(`GFE "${id}" not found`);
    return gfe;
  }

  async findByPatient(tenantId: string, patientId: string): Promise<GoodFaithEstimate[]> {
    return this.gfeRepository.find({
      where: { tenantId, patientId },
      order: { createdAt: 'DESC' },
    });
  }

  async findByStatus(tenantId: string, status: GfeStatus): Promise<GoodFaithEstimate[]> {
    return this.gfeRepository.find({
      where: { tenantId, status },
      order: { deliveryDeadline: 'ASC' },
    });
  }

  async updateGfe(tenantId: string, id: string, dto: UpdateGfeDto): Promise<GoodFaithEstimate> {
    const gfe = await this.findOneGfe(tenantId, id);
    if (dto.totalCharge !== undefined) gfe.totalCharge = dto.totalCharge;
    if (dto.insuranceEstimate !== undefined) gfe.insuranceEstimate = dto.insuranceEstimate;
    if (dto.patientEstimate !== undefined) gfe.patientEstimate = dto.patientEstimate;
    if (dto.items !== undefined) gfe.items = dto.items;
    if (dto.disclaimers !== undefined) gfe.disclaimers = dto.disclaimers;
    if (dto.complianceNotes !== undefined) gfe.complianceNotes = dto.complianceNotes;
    if (dto.notes !== undefined) gfe.notes = dto.notes;
    return this.gfeRepository.save(gfe);
  }

  async createNewVersion(tenantId: string, id: string, dto: UpdateGfeDto): Promise<GoodFaithEstimate> {
    const original = await this.findOneGfe(tenantId, id);
    // Mark original as superseded
    original.status = GfeStatus.SUPERSEDED;
    await this.gfeRepository.save(original);

    // Create new version
    const newVersion = new GoodFaithEstimate();
    Object.assign(newVersion, original);
    newVersion.id = undefined as any;
    newVersion.version = original.version + 1;
    newVersion.status = GfeStatus.DRAFT;
    newVersion.deliveredAt = null;
    newVersion.deliveredBy = null;
    newVersion.acknowledgedAt = null;
    newVersion.acknowledgedBy = null;
    newVersion.isCompliant = false;

    if (dto.totalCharge !== undefined) newVersion.totalCharge = dto.totalCharge;
    if (dto.insuranceEstimate !== undefined) newVersion.insuranceEstimate = dto.insuranceEstimate;
    if (dto.patientEstimate !== undefined) newVersion.patientEstimate = dto.patientEstimate;
    if (dto.items !== undefined) newVersion.items = dto.items;
    if (dto.disclaimers !== undefined) newVersion.disclaimers = dto.disclaimers;
    if (dto.complianceNotes !== undefined) newVersion.complianceNotes = dto.complianceNotes;
    if (dto.notes !== undefined) newVersion.notes = dto.notes;

    return this.gfeRepository.save(newVersion);
  }

  // ═══════════════════════════════════════════════════════════════════
  // P0: GFE Delivery Tracking
  // ═══════════════════════════════════════════════════════════════════

  async deliverGfe(tenantId: string, id: string, dto: DeliverGfeDto): Promise<GoodFaithEstimate> {
    const gfe = await this.findOneGfe(tenantId, id);
    if (gfe.status === GfeStatus.SUPERSEDED) {
      throw new BadRequestException('Cannot deliver a superseded GFE');
    }

    gfe.deliveryMethod = dto.deliveryMethod;
    gfe.deliveredAt = new Date();
    gfe.deliveredBy = dto.deliveredBy || null;
    gfe.status = GfeStatus.DELIVERED;

    // Check compliance: was it delivered on time?
    if (gfe.deliveryDeadline) {
      gfe.isCompliant = this.businessDayCalculator.isDeliveredOnTime(gfe.deliveredAt, gfe.deliveryDeadline);
    }

    const saved = await this.gfeRepository.save(gfe);
    this.logger.log(`GFE ${id} delivered via ${dto.deliveryMethod}, compliant: ${saved.isCompliant}`);
    return saved;
  }

  async acknowledgeGfe(tenantId: string, id: string, dto: AcknowledgeGfeDto): Promise<GoodFaithEstimate> {
    const gfe = await this.findOneGfe(tenantId, id);
    if (gfe.status !== GfeStatus.DELIVERED && gfe.status !== GfeStatus.ACKNOWLEDGED) {
      throw new BadRequestException('GFE must be delivered before acknowledgment');
    }

    gfe.acknowledgedAt = new Date();
    gfe.acknowledgedBy = dto.acknowledgedBy || 'Patient (portal)';
    gfe.status = GfeStatus.ACKNOWLEDGED;

    return this.gfeRepository.save(gfe);
  }

  // ═══════════════════════════════════════════════════════════════════
  // P0: $400 Variance Detector
  // ═══════════════════════════════════════════════════════════════════

  async detectVariance(
    tenantId: string,
    gfeId: string,
    finalBilledAmount: number,
    finalPaidAmount: number,
    actualLineItems?: Array<{ cptCode: string; actualAmount: number }>,
    claimId?: string,
    remittanceClaimId?: string,
  ): Promise<NsaVarianceRecord> {
    const gfe = await this.findOneGfe(tenantId, gfeId);
    const varianceAmount = finalBilledAmount - gfe.totalCharge;
    const exceedsThreshold = Math.abs(varianceAmount) >= NSA_VARIANCE_THRESHOLD;

    // Calculate per-item variance if line items provided
    const perItemVariance: Array<{ cptCode: string; estimated: number; actual: number; variance: number }> = [];
    if (actualLineItems) {
      for (const actual of actualLineItems) {
        const estimatedItem = gfe.items.find((i) => i.cptCode === actual.cptCode);
        if (estimatedItem) {
          perItemVariance.push({
            cptCode: actual.cptCode,
            estimated: estimatedItem.charge,
            actual: actual.actualAmount,
            variance: actual.actualAmount - estimatedItem.charge,
          });
        }
      }
    }

    const record = new NsaVarianceRecord();
    record.tenantId = tenantId;
    record.gfeId = gfeId;
    record.patientId = gfe.patientId;
    record.claimId = claimId || null;
    record.remittanceClaimId = remittanceClaimId || null;
    record.gfeAmount = gfe.totalCharge;
    record.finalBilledAmount = finalBilledAmount;
    record.varianceAmount = varianceAmount;
    record.exceedsThreshold = exceedsThreshold;
    record.status = exceedsThreshold ? VarianceRecordStatus.DETECTED : VarianceRecordStatus.DISMISSED;
    record.perItemVariance = perItemVariance;

    const saved = await this.varianceRepository.save(record);

    // Update GFE variance status
    if (exceedsThreshold) {
      gfe.varianceAmount = varianceAmount;
      gfe.varianceStatus = VarianceStatus.OVER_THRESHOLD;
      gfe.status = GfeStatus.DISPUTED;
    } else {
      gfe.varianceAmount = varianceAmount;
      gfe.varianceStatus = VarianceStatus.UNDER_THRESHOLD;
    }
    await this.gfeRepository.save(gfe);

    this.logger.log(
      `Variance detected for GFE ${gfeId}: $${varianceAmount} (${exceedsThreshold ? 'EXCEEDS' : 'under'} $${NSA_VARIANCE_THRESHOLD} threshold)`,
    );

    return saved;
  }

  async findVarianceRecords(tenantId: string, gfeId?: string): Promise<NsaVarianceRecord[]> {
    if (gfeId) {
      return this.varianceRepository.find({ where: { tenantId, gfeId }, order: { createdAt: 'DESC' } });
    }
    return this.varianceRepository.find({ where: { tenantId }, order: { createdAt: 'DESC' } });
  }

  async resolveVariance(tenantId: string, varianceId: string, resolutionNotes: string): Promise<NsaVarianceRecord> {
    const record = await this.varianceRepository.findOne({ where: { id: varianceId, tenantId } });
    if (!record) throw new NotFoundException(`Variance record "${varianceId}" not found`);
    record.status = VarianceRecordStatus.RESOLVED;
    record.resolvedAt = new Date();
    record.resolutionNotes = resolutionNotes;
    return this.varianceRepository.save(record);
  }

  // ═══════════════════════════════════════════════════════════════════
  // P0: Compliance Dashboard
  // ═══════════════════════════════════════════════════════════════════

  async getComplianceDashboard(tenantId: string): Promise<{
    totalGfes: number;
    delivered: number;
    acknowledged: number;
    disputed: number;
    onTimeDeliveryRate: number;
    pendingDelivery: number;
    overdueDelivery: number;
    varianceDetected: number;
    varianceOverThreshold: number;
    idrCasesOpen: number;
  }> {
    const allGfes = await this.gfeRepository.find({ where: { tenantId } });
    const delivered = allGfes.filter((g) => g.status === GfeStatus.DELIVERED || g.status === GfeStatus.ACKNOWLEDGED);
    const onTime = delivered.filter((g) => g.isCompliant);
    const acknowledged = allGfes.filter((g) => g.status === GfeStatus.ACKNOWLEDGED);
    const disputed = allGfes.filter((g) => g.status === GfeStatus.DISPUTED);
    const now = new Date();
    const pendingDelivery = allGfes.filter((g) => g.status === GfeStatus.DRAFT);
    const overdueDelivery = allGfes.filter(
      (g) => g.status === GfeStatus.DRAFT && g.deliveryDeadline && g.deliveryDeadline < now,
    );

    const variances = await this.varianceRepository.find({ where: { tenantId } });
    const varianceOverThreshold = variances.filter((v) => v.exceedsThreshold && v.status !== VarianceRecordStatus.RESOLVED);

    const idrCases = await this.idrCaseRepository.find({ where: { tenantId } });
    const idrCasesOpen = idrCases.filter(
      (c) => c.status !== IdrCaseStatus.WON && c.status !== IdrCaseStatus.LOST && c.status !== IdrCaseStatus.WITHDRAWN && c.status !== IdrCaseStatus.EXPIRED && c.status !== IdrCaseStatus.SETTLED,
    );

    return {
      totalGfes: allGfes.length,
      delivered: delivered.length,
      acknowledged: acknowledged.length,
      disputed: disputed.length,
      onTimeDeliveryRate: delivered.length > 0 ? (onTime.length / delivered.length) * 100 : 0,
      pendingDelivery: pendingDelivery.length,
      overdueDelivery: overdueDelivery.length,
      varianceDetected: variances.length,
      varianceOverThreshold: varianceOverThreshold.length,
      idrCasesOpen: idrCasesOpen.length,
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // P1: AI Estimate Accuracy Predictor
  // ═══════════════════════════════════════════════════════════════════

  async predictAccuracy(tenantId: string, gfeId: string): Promise<GoodFaithEstimate> {
    const gfe = await this.findOneGfe(tenantId, gfeId);

    // Gather historical accuracy data
    const historicalGfes = await this.gfeRepository.find({
      where: { tenantId, patientId: gfe.patientId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
    const reconciled = historicalGfes.filter((g) => g.reconciliationData);
    const historicalAccuracy = reconciled.length > 0
      ? {
          avgVariance: reconciled.reduce((sum, g) => sum + (g.reconciliationData?.accuracyScore || 0), 0) / reconciled.length,
          sampleSize: reconciled.length,
          byCptCode: this.aggregateCptVariance(reconciled),
        }
      : undefined;

    const prediction = await this.nsaAiService.predictEstimateAccuracy(gfe, historicalAccuracy);

    gfe.aiAccuracyScore = prediction.accuracyScore;
    gfe.aiAccuracyFlags = {
      highRisk: prediction.highRisk,
      riskFactors: prediction.riskFactors,
      recommendedActions: prediction.recommendedActions,
    };

    return this.gfeRepository.save(gfe);
  }

  private aggregateCptVariance(gfes: GoodFaithEstimate[]): Record<string, number> {
    const byCode: Record<string, number[]> = {};
    for (const gfe of gfes) {
      if (gfe.reconciliationData?.perItemVariance) {
        for (const item of gfe.reconciliationData.perItemVariance) {
          if (!byCode[item.cptCode]) byCode[item.cptCode] = [];
          byCode[item.cptCode].push(Math.abs(item.variance));
        }
      }
    }
    const result: Record<string, number> = {};
    for (const [code, values] of Object.entries(byCode)) {
      result[code] = values.reduce((a, b) => a + b, 0) / values.length;
    }
    return result;
  }

  // ═══════════════════════════════════════════════════════════════════
  // P1: AI GFE-to-Claim Reconciliation Loop
  // ═══════════════════════════════════════════════════════════════════

  async reconcileGfe(
    tenantId: string,
    gfeId: string,
    finalBilledAmount: number,
    finalPaidAmount: number,
    actualLineItems: Array<{ cptCode: string; actualAmount: number }>,
  ): Promise<GoodFaithEstimate> {
    const gfe = await this.findOneGfe(tenantId, gfeId);
    const reconciliation = await this.nsaAiService.reconcileGfeWithClaim(
      gfe,
      finalBilledAmount,
      finalPaidAmount,
      actualLineItems,
    );

    gfe.reconciliationData = {
      reconciledAt: new Date().toISOString(),
      finalBilledAmount,
      finalPaidAmount,
      perItemVariance: reconciliation.perItemVariance,
      accuracyScore: reconciliation.accuracyScore,
    };

    return this.gfeRepository.save(gfe);
  }

  // ═══════════════════════════════════════════════════════════════════
  // P1: AI Patient-Friendly GFE Explainer
  // ═══════════════════════════════════════════════════════════════════

  async generatePatientExplanation(tenantId: string, gfeId: string): Promise<GoodFaithEstimate> {
    const gfe = await this.findOneGfe(tenantId, gfeId);
    const explanation = await this.nsaAiService.generatePatientFriendlyExplanation(gfe);
    gfe.patientFriendlyExplanation = explanation.explanation;
    return this.gfeRepository.save(gfe);
  }

  // ═══════════════════════════════════════════════════════════════════
  // P1: AI Diagnosis-Code Completion
  // ═══════════════════════════════════════════════════════════════════

  async predictDiagnosisCodes(
    tenantId: string,
    gfeId: string,
    patientHistory: { conditions: string[]; medications: string[]; recentEncounters: string[] },
    chiefComplaint: string,
    scheduledProcedure: string,
  ): Promise<GoodFaithEstimate> {
    const gfe = await this.findOneGfe(tenantId, gfeId);
    const prediction = await this.nsaAiService.predictDiagnosisCodes(
      patientHistory,
      chiefComplaint,
      scheduledProcedure,
    );
    gfe.predictedDiagnosisCodes = prediction.predictedCodes;
    return this.gfeRepository.save(gfe);
  }

  // ═══════════════════════════════════════════════════════════════════
  // P2: IDR Case Management
  // ═══════════════════════════════════════════════════════════════════

  async createIdrCase(tenantId: string, dto: CreateIdrCaseDto): Promise<NsaIdrCase> {
    const idrCase = new NsaIdrCase();
    idrCase.tenantId = tenantId;
    idrCase.patientId = dto.patientId;
    idrCase.patientName = dto.patientName || null;
    idrCase.claimId = dto.claimId || null;
    idrCase.gfeId = dto.gfeId || null;
    idrCase.varianceRecordId = dto.varianceRecordId || null;
    idrCase.payerName = dto.payerName || null;
    idrCase.billedAmount = dto.billedAmount || null;
    idrCase.status = IdrCaseStatus.OPEN_NEGOTIATION;
    idrCase.jurisdiction = IdrJurisdiction.FEDERAL;
    idrCase.openNegotiationDate = new Date();
    idrCase.encounterNotes = dto.encounterNotes || null;
    idrCase.cptCodes = dto.cptCodes || [];
    idrCase.supportDocuments = [];

    // Calculate deadlines
    const openNegotiationEnd = this.businessDayCalculator.calculateOpenNegotiationDeadline(idrCase.openNegotiationDate);
    idrCase.idrInitiationDeadline = this.businessDayCalculator.calculateIdrInitiationDeadline(openNegotiationEnd);
    idrCase.idrSubmissionDeadline = this.businessDayCalculator.calculateIdrSubmissionDeadline(idrCase.idrInitiationDeadline);

    const saved = await this.idrCaseRepository.save(idrCase);

    // Create deadline tracking records
    await this.createDeadline(tenantId, saved.id, DeadlineType.OPEN_NEGOTIATION, openNegotiationEnd);
    await this.createDeadline(tenantId, saved.id, DeadlineType.IDR_INITIATION, saved.idrInitiationDeadline!);
    await this.createDeadline(tenantId, saved.id, DeadlineType.IDR_SUBMISSION, saved.idrSubmissionDeadline!);

    this.logger.log(`IDR case created: ${saved.id}, open negotiation deadline: ${openNegotiationEnd.toISOString()}`);
    return saved;
  }

  async findIdrCases(tenantId: string, status?: IdrCaseStatus): Promise<NsaIdrCase[]> {
    if (status) {
      return this.idrCaseRepository.find({ where: { tenantId, status }, order: { createdAt: 'DESC' } });
    }
    return this.idrCaseRepository.find({ where: { tenantId }, order: { createdAt: 'DESC' } });
  }

  async findOneIdrCase(tenantId: string, id: string): Promise<NsaIdrCase> {
    const idrCase = await this.idrCaseRepository.findOne({ where: { id, tenantId } });
    if (!idrCase) throw new NotFoundException(`IDR case "${id}" not found`);
    return idrCase;
  }

  async updateIdrCase(tenantId: string, id: string, dto: UpdateIdrCaseDto): Promise<NsaIdrCase> {
    const idrCase = await this.findOneIdrCase(tenantId, id);
    if (dto.status !== undefined) idrCase.status = dto.status as IdrCaseStatus;
    if (dto.qpaAmount !== undefined) idrCase.qpaAmount = dto.qpaAmount;
    if (dto.initialOffer !== undefined) idrCase.initialOffer = dto.initialOffer;
    if (dto.finalOffer !== undefined) idrCase.finalOffer = dto.finalOffer;
    if (dto.determinedAmount !== undefined) idrCase.determinedAmount = dto.determinedAmount;
    if (dto.resolutionNotes !== undefined) idrCase.resolutionNotes = dto.resolutionNotes;
    if (idrCase.status === IdrCaseStatus.WON || idrCase.status === IdrCaseStatus.LOST || idrCase.status === IdrCaseStatus.SETTLED) {
      idrCase.resolvedAt = new Date();
    }
    return this.idrCaseRepository.save(idrCase);
  }

  // ═══════════════════════════════════════════════════════════════════
  // P2: AI IDR Eligibility Engine
  // ═══════════════════════════════════════════════════════════════════

  async assessIdrEligibility(
    tenantId: string,
    idrCaseId: string,
    claimData: {
      patientState: string;
      paidAmount: number;
      serviceType: string;
      isEmergency: boolean;
      isAirAmbulance: boolean;
      payerType: string;
    },
  ): Promise<NsaIdrCase> {
    const idrCase = await this.findOneIdrCase(tenantId, idrCaseId);

    const result = await this.nsaAiService.assessIdrEligibility({
      payerName: idrCase.payerName || '',
      patientState: claimData.patientState,
      billedAmount: idrCase.billedAmount || 0,
      paidAmount: claimData.paidAmount,
      cptCodes: idrCase.cptCodes,
      serviceType: claimData.serviceType,
      isEmergency: claimData.isEmergency,
      isAirAmbulance: claimData.isAirAmbulance,
      payerType: claimData.payerType,
    });

    idrCase.eligibilityScore = result.eligibilityScore;
    idrCase.eligibilityFactors = result.factors;
    idrCase.expectedRecovery = result.expectedRecovery;
    idrCase.jurisdiction = result.jurisdiction as IdrJurisdiction;

    return this.idrCaseRepository.save(idrCase);
  }

  // ═══════════════════════════════════════════════════════════════════
  // P2: AI Open Negotiation Offer Generator
  // ═══════════════════════════════════════════════════════════════════

  async generateOpenNegotiationOffer(
    tenantId: string,
    idrCaseId: string,
    medianInNetworkRates?: Array<{ cptCode: string; medianRate: number }>,
  ): Promise<NsaIdrCase> {
    const idrCase = await this.findOneIdrCase(tenantId, idrCaseId);
    const offer = await this.nsaAiService.generateOpenNegotiationOffer(idrCase, medianInNetworkRates);

    idrCase.recommendedOffer = offer.recommendedOffer;
    idrCase.offerRationale = offer.rationale;
    if (!idrCase.qpaAmount) {
      idrCase.qpaAmount = offer.qpaEstimate;
    }
    if (!idrCase.initialOffer) {
      idrCase.initialOffer = offer.recommendedOffer;
    }

    return this.idrCaseRepository.save(idrCase);
  }

  // ═══════════════════════════════════════════════════════════════════
  // P2: AI State/Federal Jurisdiction Router
  // ═══════════════════════════════════════════════════════════════════

  async routeJurisdiction(
    tenantId: string,
    idrCaseId: string,
    patientState: string,
    payerType: string,
    serviceType: string,
    isEmergency: boolean,
  ): Promise<NsaIdrCase> {
    const idrCase = await this.findOneIdrCase(tenantId, idrCaseId);
    const result = await this.nsaAiService.routeJurisdiction(patientState, payerType, serviceType, isEmergency);
    idrCase.jurisdiction = result.jurisdiction as IdrJurisdiction;
    return this.idrCaseRepository.save(idrCase);
  }

  // ═══════════════════════════════════════════════════════════════════
  // P2: AI Patient Acuity Letter Generator
  // ═══════════════════════════════════════════════════════════════════

  async generateAcuityLetter(
    tenantId: string,
    idrCaseId: string,
    patientInfo: { age?: number; sex?: string; conditions: string[] },
  ): Promise<NsaIdrCase> {
    const idrCase = await this.findOneIdrCase(tenantId, idrCaseId);
    if (!idrCase.encounterNotes) {
      throw new BadRequestException('Encounter notes are required to generate a patient acuity letter');
    }

    const letter = await this.nsaAiService.generatePatientAcuityLetter(
      idrCase.encounterNotes,
      idrCase.cptCodes,
      patientInfo,
    );

    idrCase.patientAcuityLetter = letter.letter;
    idrCase.supportDocuments = [
      ...idrCase.supportDocuments,
      { name: 'Patient Acuity Letter', type: 'acuity_letter', content: letter.letter },
    ];

    return this.idrCaseRepository.save(idrCase);
  }

  // ═══════════════════════════════════════════════════════════════════
  // P3: AI IDR Win-Probability Model
  // ═══════════════════════════════════════════════════════════════════

  async predictWinProbability(
    tenantId: string,
    idrCaseId: string,
  ): Promise<NsaIdrCase> {
    const idrCase = await this.findOneIdrCase(tenantId, idrCaseId);

    // Gather historical outcomes
    const allCases = await this.idrCaseRepository.find({ where: { tenantId } });
    const completedCases = allCases.filter(
      (c) => c.status === IdrCaseStatus.WON || c.status === IdrCaseStatus.LOST,
    );
    const wonCases = completedCases.filter((c) => c.status === IdrCaseStatus.WON);
    const byPayer: Record<string, { won: number; total: number }> = {};
    for (const c of completedCases) {
      const payer = c.payerName || 'unknown';
      if (!byPayer[payer]) byPayer[payer] = { won: 0, total: 0 };
      byPayer[payer].total++;
      if (c.status === IdrCaseStatus.WON) byPayer[payer].won++;
    }
    const historicalOutcomes = completedCases.length > 0
      ? {
          totalCases: completedCases.length,
          wonCases: wonCases.length,
          avgRecovery: completedCases.reduce((sum, c) => sum + (c.determinedAmount || 0), 0) / completedCases.length,
          byPayer,
        }
      : undefined;

    const result = await this.nsaAiService.predictWinProbability(idrCase, historicalOutcomes);

    idrCase.winProbability = result.winProbability;
    idrCase.winProbabilityFactors = result.factors;
    if (!idrCase.finalOffer) {
      idrCase.finalOffer = result.recommendedFinalOffer;
    }

    return this.idrCaseRepository.save(idrCase);
  }

  // ═══════════════════════════════════════════════════════════════════
  // P3: Deadline Tracking
  // ═══════════════════════════════════════════════════════════════════

  async createDeadline(
    tenantId: string,
    idrCaseId: string,
    type: DeadlineType,
    dueDate: Date,
  ): Promise<NsaIdrDeadline> {
    const deadline = new NsaIdrDeadline();
    deadline.tenantId = tenantId;
    deadline.idrCaseId = idrCaseId;
    deadline.deadlineType = type;
    deadline.dueDate = dueDate;
    deadline.status = DeadlineStatus.UPCOMING;
    return this.deadlineRepository.save(deadline);
  }

  async findDeadlines(tenantId: string, idrCaseId?: string): Promise<NsaIdrDeadline[]> {
    if (idrCaseId) {
      return this.deadlineRepository.find({ where: { tenantId, idrCaseId }, order: { dueDate: 'ASC' } });
    }
    return this.deadlineRepository.find({ where: { tenantId }, order: { dueDate: 'ASC' } });
  }

  async updateDeadlineStatuses(tenantId: string): Promise<void> {
    const deadlines = await this.deadlineRepository.find({
      where: { tenantId, isMet: false },
    });
    const now = new Date();
    const dueSoonThreshold = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 days

    for (const deadline of deadlines) {
      if (deadline.dueDate < now) {
        deadline.status = DeadlineStatus.OVERDUE;
      } else if (deadline.dueDate < dueSoonThreshold) {
        deadline.status = DeadlineStatus.DUE_SOON;
      }
      await this.deadlineRepository.save(deadline);
    }
  }

  async markDeadlineMet(tenantId: string, deadlineId: string): Promise<NsaIdrDeadline> {
    const deadline = await this.deadlineRepository.findOne({ where: { id: deadlineId, tenantId } });
    if (!deadline) throw new NotFoundException(`Deadline "${deadlineId}" not found`);
    deadline.isMet = true;
    deadline.metAt = new Date();
    deadline.status = DeadlineStatus.MET;
    return this.deadlineRepository.save(deadline);
  }
}


