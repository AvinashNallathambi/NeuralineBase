import { Injectable, Logger, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Remittance, RemittanceStatus, RemittanceType } from './entities/remittance.entity';
import { RemittanceClaim } from './entities/remittance-claim.entity';
import { RemittanceServiceLine } from './entities/remittance-service-line.entity';
import { ClaimAdjustment } from './entities/claim-adjustment.entity';
import { EOB, EobFormat } from './entities/eob.entity';
import { CarcCode } from './entities/carc-code.entity';
import { RarcCode } from './entities/rarc-code.entity';
import { X12Parser835, Parsed835 } from './x12-parser-835.service';
import { ImportEraDto, ImportEobDto } from './dto/import-era.dto';
import { EncounterClaim, ClaimStatus } from '../billing/entities/encounter-claim.entity';
import { ClaimLineItem } from '../billing/entities/claim-line-item.entity';
import { DenialsService } from '../denials/denials.service';

@Injectable()
export class RemittanceService {
  private readonly logger = new Logger(RemittanceService.name);

  constructor(
    @InjectRepository(Remittance)
    private readonly remittanceRepository: Repository<Remittance>,
    @InjectRepository(RemittanceClaim)
    private readonly remittanceClaimRepository: Repository<RemittanceClaim>,
    @InjectRepository(RemittanceServiceLine)
    private readonly serviceLineRepository: Repository<RemittanceServiceLine>,
    @InjectRepository(ClaimAdjustment)
    private readonly adjustmentRepository: Repository<ClaimAdjustment>,
    @InjectRepository(EOB)
    private readonly eobRepository: Repository<EOB>,
    @InjectRepository(CarcCode)
    private readonly carcRepository: Repository<CarcCode>,
    @InjectRepository(RarcCode)
    private readonly rarcRepository: Repository<RarcCode>,
    @InjectRepository(EncounterClaim)
    private readonly claimRepository: Repository<EncounterClaim>,
    @InjectRepository(ClaimLineItem)
    private readonly lineItemRepository: Repository<ClaimLineItem>,
    private readonly parser: X12Parser835,
    private readonly dataSource: DataSource,
    @Inject(forwardRef(() => DenialsService))
    private readonly denialsService: DenialsService,
  ) {}

  // ─── ERA Import & Parsing ──────────────────────────────────────────

  async importEra(dto: ImportEraDto, tenantId: string): Promise<Remittance> {
    this.logger.log(`Importing ERA file for tenant ${tenantId}`);

    // Parse the 835 file
    const parsed = this.parser.parse(dto.fileContent);

    if (parsed.claims.length === 0) {
      throw new BadRequestException('No claims found in 835 file');
    }

    // Check for duplicate import (same trace number)
    const existing = await this.remittanceRepository.findOne({
      where: { tenantId, traceNumber: parsed.traceNumber },
    });
    if (existing) {
      throw new BadRequestException(
        `ERA with trace number ${parsed.traceNumber} already imported (ID: ${existing.id})`,
      );
    }

    // Create remittance record
    const remittance = this.remittanceRepository.create({
      tenantId,
      traceNumber: parsed.traceNumber,
      remittanceDate: parsed.remittanceDate,
      type: RemittanceType.ERA,
      status: RemittanceStatus.IMPORTED,
      payerName: parsed.payerName,
      payerIdentifier: parsed.payerIdentifier || null,
      paymentMethod: parsed.paymentMethod || null,
      paymentReference: parsed.paymentReference || null,
      totalPaymentAmount: parsed.totalPaymentAmount,
      totalClaimCount: parsed.claims.length,
      totalBilledAmount: parsed.claims.reduce((sum, c) => sum + c.billedAmount, 0),
      rawFileContent: dto.fileContent,
      fileName: dto.fileName || null,
    });

    const savedRemittance = await this.remittanceRepository.save(remittance);

    // Create claim and service line records
    for (const parsedClaim of parsed.claims) {
      const claim = await this.createRemittanceClaim(parsedClaim, savedRemittance.id, tenantId);
      // Match to existing EncounterClaim
      await this.matchClaimToEncounter(claim, tenantId);
    }

    // Auto-post payments
    const postResult = await this.autoPostPayments(savedRemittance.id, tenantId);

    this.logger.log(
      `ERA imported: ${parsed.claims.length} claims, ${postResult.postedCount} posted, ${postResult.postedAmount} posted amount`,
    );

    // Auto-generate denial records from this remittance's adjustments.
    // This was previously a manual step (POST /denials/generate/:remittanceId);
    // now it fires automatically on ERA import so denials appear in the
    // worklist without staff having to remember to trigger generation.
    try {
      const denialCount = await this.denialsService.generateFromRemittance(savedRemittance.id, tenantId);
      if (denialCount > 0) {
        this.logger.log(`Auto-generated ${denialCount} denial records from remittance ${savedRemittance.id}`);
      }
    } catch (err) {
      // Denial generation failure must not fail the ERA import — the
      // remittance and payments are already saved. Staff can re-trigger
      // denial generation manually via POST /denials/generate/:remittanceId.
      this.logger.error(
        `Auto-denial generation failed for remittance ${savedRemittance.id}: ${(err as Error).message}`,
      );
    }

    return this.findOneRemittance(savedRemittance.id);
  }

  private async createRemittanceClaim(
    parsedClaim: Parsed835['claims'][0],
    remittanceId: string,
    tenantId: string,
  ): Promise<RemittanceClaim> {
    const claim = new RemittanceClaim();
    claim.tenantId = tenantId;
    claim.remittanceId = remittanceId;
    claim.payerClaimId = parsedClaim.payerClaimId;
    claim.claimStatusCode = parsedClaim.claimStatusCode;
    claim.billedAmount = parsedClaim.billedAmount;
    claim.paidAmount = parsedClaim.paidAmount;
    claim.patientResponsibilityAmount = parsedClaim.patientResponsibilityAmount;
    claim.adjustedAmount = parsedClaim.adjustedAmount;
    claim.facilityType = parsedClaim.facilityType || null;
    claim.claimFrequency = parsedClaim.claimFrequency || null;
    claim.patientName = parsedClaim.patientName || null;
    claim.insuredName = parsedClaim.insuredName || null;
    claim.serviceDate = parsedClaim.serviceDate || null;

    const savedClaim = await this.remittanceClaimRepository.save(claim);

    // Create service lines
    for (const parsedLine of parsedClaim.serviceLines) {
      const serviceLine = new RemittanceServiceLine();
      serviceLine.tenantId = tenantId;
      serviceLine.remittanceClaimId = savedClaim.id;
      serviceLine.cptCode = parsedLine.cptCode;
      serviceLine.serviceIdQualifier = parsedLine.serviceIdQualifier || 'HC';
      serviceLine.modifier1 = parsedLine.modifiers[0] || null;
      serviceLine.modifier2 = parsedLine.modifiers[1] || null;
      serviceLine.modifier3 = parsedLine.modifiers[2] || null;
      serviceLine.modifier4 = parsedLine.modifiers[3] || null;
      serviceLine.units = parsedLine.units;
      serviceLine.billedAmount = parsedLine.billedAmount;
      serviceLine.paidAmount = parsedLine.paidAmount;
      serviceLine.adjustedAmount = parsedLine.adjustments.reduce((sum, a) => sum + a.amount, 0);
      serviceLine.serviceDate = parsedLine.serviceDate || null;

      const savedLine = await this.serviceLineRepository.save(serviceLine);

      // Create adjustments for service line
      for (const adj of parsedLine.adjustments) {
        const adjustment = new ClaimAdjustment();
        adjustment.tenantId = tenantId;
        adjustment.remittanceClaimId = savedClaim.id;
        adjustment.serviceLineId = savedLine.id;
        adjustment.groupCode = adj.groupCode;
        adjustment.carcCode = adj.carcCode;
        adjustment.adjustmentAmount = adj.amount;
        adjustment.quantity = adj.quantity || null;
        adjustment.rarcCode = adj.rarcCode || null;
        await this.adjustmentRepository.save(adjustment);
      }
    }

    // Create claim-level adjustments
    for (const adj of parsedClaim.claimAdjustments) {
      const adjustment = new ClaimAdjustment();
      adjustment.tenantId = tenantId;
      adjustment.remittanceClaimId = savedClaim.id;
      adjustment.serviceLineId = null;
      adjustment.groupCode = adj.groupCode;
      adjustment.carcCode = adj.carcCode;
      adjustment.adjustmentAmount = adj.amount;
      adjustment.quantity = adj.quantity || null;
      adjustment.rarcCode = adj.rarcCode || null;
      await this.adjustmentRepository.save(adjustment);
    }

    // Enrich with CARC/RARC descriptions
    await this.enrichAdjustmentDescriptions(savedClaim.id, tenantId);

    return savedClaim;
  }

  private async enrichAdjustmentDescriptions(remittanceClaimId: string, tenantId: string): Promise<void> {
    const adjustments = await this.adjustmentRepository.find({
      where: { remittanceClaimId, tenantId },
    });

    for (const adj of adjustments) {
      if (!adj.carcDescription) {
        const carc = await this.carcRepository.findOne({ where: { code: adj.carcCode } });
        if (carc) {
          adj.carcDescription = carc.description;
          adj.rootCauseCategory = carc.rootCauseCategory;
        }
      }
      if (adj.rarcCode && !adj.rarcDescription) {
        const rarc = await this.rarcRepository.findOne({ where: { code: adj.rarcCode } });
        if (rarc) {
          adj.rarcDescription = rarc.description;
          if (!adj.rootCauseCategory) {
            adj.rootCauseCategory = rarc.rootCauseCategory;
          }
        }
      }
      await this.adjustmentRepository.save(adj);
    }
  }

  // ─── Claim Matching ────────────────────────────────────────────────

  private async matchClaimToEncounter(
    remittanceClaim: RemittanceClaim,
    tenantId: string,
  ): Promise<void> {
    // Try to match by payerClaimId (which may be our claim number)
    let matchedClaim: EncounterClaim | null = null;

    // Strategy 1: Match by claim number (payerClaimId may contain our claim number)
    if (remittanceClaim.payerClaimId) {
      matchedClaim = await this.claimRepository.findOne({
        where: { tenantId, claimNumber: remittanceClaim.payerClaimId },
      });
    }

    // Strategy 2: Match by patient name + billed amount + service date
    if (!matchedClaim && remittanceClaim.patientName) {
      const candidates = await this.claimRepository.find({
        where: { tenantId, patientName: remittanceClaim.patientName, status: ClaimStatus.SUBMITTED },
      });
      // Find closest match by billed amount
      matchedClaim = candidates.find(
        (c) => Math.abs(c.totalBilled - remittanceClaim.billedAmount) < 0.01,
      ) || null;
    }

    if (matchedClaim) {
      remittanceClaim.matchedClaimId = matchedClaim.id;
      remittanceClaim.matchedClaimNumber = matchedClaim.claimNumber;
      remittanceClaim.patientId = matchedClaim.patientId;
      remittanceClaim.isMatched = true;
      await this.remittanceClaimRepository.save(remittanceClaim);
      this.logger.debug(`Matched remittance claim to EncounterClaim ${matchedClaim.claimNumber}`);
    } else {
      this.logger.warn(
        `No match found for remittance claim ${remittanceClaim.payerClaimId} (patient: ${remittanceClaim.patientName})`,
      );
    }
  }

  // ─── Auto-Payment Posting ──────────────────────────────────────────

  async autoPostPayments(remittanceId: string, tenantId: string): Promise<{
    postedCount: number;
    postedAmount: number;
    unmatchedCount: number;
  }> {
    const remittance = await this.findOneRemittance(remittanceId);
    const claims = await this.remittanceClaimRepository.find({
      where: { remittanceId, tenantId },
    });

    let postedCount = 0;
    let postedAmount = 0;
    let unmatchedCount = 0;

    for (const claim of claims) {
      if (claim.isPosted) continue;

      if (!claim.matchedClaimId) {
        unmatchedCount++;
        continue;
      }

      await this.dataSource.transaction(async (manager) => {
        // Update the EncounterClaim
        const encounterClaim = await manager.findOne(EncounterClaim, {
          where: { id: claim.matchedClaimId! },
        });
        if (!encounterClaim) return;

        // Determine new status based on claim status code
        let newStatus: ClaimStatus;
        if (claim.claimStatusCode === '4') {
          // Denied
          newStatus = ClaimStatus.DENIED;
        } else if (claim.paidAmount > 0 && claim.adjustedAmount > 0) {
          newStatus = ClaimStatus.PARTIALLY_PAID;
        } else if (claim.paidAmount > 0) {
          newStatus = ClaimStatus.PAID;
        } else {
          newStatus = encounterClaim.status;
        }

        encounterClaim.status = newStatus;
        encounterClaim.totalPaid = claim.paidAmount;
        encounterClaim.patientResponsibility = claim.patientResponsibilityAmount;
        encounterClaim.adjustmentAmount = claim.adjustedAmount;

        // Set denial reason if denied
        if (newStatus === ClaimStatus.DENIED) {
          const adjustments = await manager.find(ClaimAdjustment, {
            where: { remittanceClaimId: claim.id, tenantId },
          });
          const denialReasons = adjustments
            .filter((a) => a.groupCode !== 'PR')
            .map((a) => `${a.groupCode}-${a.carcCode}: ${a.carcDescription || ''}`)
            .join('; ');
          encounterClaim.denialReason = denialReasons || 'Denied by payer';
        }

        await manager.save(encounterClaim);

        // Update service line items
        const serviceLines = await this.serviceLineRepository.find({
          where: { remittanceClaimId: claim.id, tenantId },
        });

        for (const sl of serviceLines) {
          // Match to claim line item by CPT code
          const lineItem = await manager.findOne(ClaimLineItem, {
            where: { claimId: encounterClaim.id, code: sl.cptCode },
          });
          if (lineItem) {
            lineItem.paidAmount = sl.paidAmount;
            lineItem.adjustmentAmount = sl.adjustedAmount;
            lineItem.allowedAmount = sl.allowedAmount || sl.paidAmount;
            sl.matchedLineItemId = lineItem.id;
            await manager.save(lineItem);
            await manager.save(sl);
          }
        }

        // Mark as posted
        claim.isPosted = true;
        claim.postedAt = new Date();
        await manager.save(claim);

        postedCount++;
        postedAmount += claim.paidAmount;
      });
    }

    // Update remittance status
    if (postedCount === claims.length) {
      remittance.status = RemittanceStatus.POSTED;
    } else if (postedCount > 0) {
      remittance.status = RemittanceStatus.PARTIALLY_POSTED;
    }
    remittance.postedCount = postedCount;
    remittance.postedAmount = postedAmount;
    await this.remittanceRepository.save(remittance);

    return { postedCount, postedAmount, unmatchedCount };
  }

  // ─── EOB Management ────────────────────────────────────────────────

  async importEob(dto: ImportEobDto, tenantId: string): Promise<EOB> {
    const eob = new EOB();
    eob.tenantId = tenantId;
    eob.patientId = dto.patientId || null;
    eob.patientName = dto.patientName || null;
    eob.claimId = dto.claimId || null;
    eob.claimNumber = dto.claimNumber || null;
    eob.payerName = dto.payerName || null;
    eob.eobDate = dto.eobDate ? new Date(dto.eobDate) : null;
    eob.serviceDate = dto.serviceDate ? new Date(dto.serviceDate) : null;
    eob.format = (dto.format as EobFormat) || EobFormat.PDF;
    eob.documentRef = dto.documentRef || null;
    eob.structuredData = dto.structuredData || {};
    eob.totalBilled = dto.totalBilled || null;
    eob.totalPaid = dto.totalPaid || null;
    eob.patientResponsibility = dto.patientResponsibility || null;
    eob.adjustmentAmount = dto.adjustmentAmount || null;
    eob.isDenied = dto.isDenied || false;
    eob.denialCodes = dto.denialCodes || null;
    eob.denialReasonText = dto.denialReasonText || null;

    return this.eobRepository.save(eob);
  }

  async findAllEobs(tenantId: string, patientId?: string): Promise<EOB[]> {
    const where: any = { tenantId };
    if (patientId) where.patientId = patientId;
    return this.eobRepository.find({ where, order: { createdAt: 'DESC' } });
  }

  async findOneEob(id: string): Promise<EOB> {
    const eob = await this.eobRepository.findOne({ where: { id } });
    if (!eob) throw new NotFoundException(`EOB with ID ${id} not found`);
    return eob;
  }

  // ─── Query Methods ─────────────────────────────────────────────────

  async findAllRemittances(tenantId: string, status?: RemittanceStatus): Promise<Remittance[]> {
    const where: any = { tenantId };
    if (status) where.status = status;
    return this.remittanceRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async findOneRemittance(id: string): Promise<Remittance> {
    const remittance = await this.remittanceRepository.findOne({
      where: { id },
      relations: ['claims'],
    });
    if (!remittance) throw new NotFoundException(`Remittance with ID ${id} not found`);
    return remittance;
  }

  async findOneRemittanceClaim(id: string): Promise<RemittanceClaim> {
    const claim = await this.remittanceClaimRepository.findOne({
      where: { id },
      relations: ['serviceLines', 'serviceLines.adjustments'],
    });
    if (!claim) throw new NotFoundException(`Remittance claim with ID ${id} not found`);
    return claim;
  }

  async getRemittanceClaims(remittanceId: string, tenantId: string): Promise<RemittanceClaim[]> {
    return this.remittanceClaimRepository.find({
      where: { remittanceId, tenantId },
      relations: ['serviceLines', 'serviceLines.adjustments'],
      order: { createdAt: 'ASC' },
    });
  }

  // ─── CARC/RARC Lookup ──────────────────────────────────────────────

  async findCarcCodes(query?: string): Promise<CarcCode[]> {
    const where: any = { isActive: true };
    if (query) {
      return this.carcRepository
        .createQueryBuilder('carc')
        .where('carc.is_active = :active', { active: true })
        .andWhere('(carc.code ILIKE :q OR carc.description ILIKE :q)', { q: `%${query}%` })
        .orderBy('carc.code')
        .getMany();
    }
    return this.carcRepository.find({ where, order: { code: 'ASC' } });
  }

  async findRarcCodes(query?: string): Promise<RarcCode[]> {
    const where: any = { isActive: true };
    if (query) {
      return this.rarcRepository
        .createQueryBuilder('rarc')
        .where('rarc.is_active = :active', { active: true })
        .andWhere('(rarc.code ILIKE :q OR rarc.description ILIKE :q)', { q: `%${query}%` })
        .orderBy('rarc.code')
        .getMany();
    }
    return this.rarcRepository.find({ where, order: { code: 'ASC' } });
  }

  async findOneCarc(code: string): Promise<CarcCode> {
    const carc = await this.carcRepository.findOne({ where: { code } });
    if (!carc) throw new NotFoundException(`CARC code ${code} not found`);
    return carc;
  }

  async findOneRarc(code: string): Promise<RarcCode> {
    const rarc = await this.rarcRepository.findOne({ where: { code } });
    if (!rarc) throw new NotFoundException(`RARC code ${code} not found`);
    return rarc;
  }

  // ─── Stats ─────────────────────────────────────────────────────────

  async getStats(tenantId: string): Promise<{
    totalRemittances: number;
    totalPosted: number;
    totalPending: number;
    totalPaymentAmount: number;
    totalClaimCount: number;
    unmatchedClaimCount: number;
    deniedClaimCount: number;
  }> {
    const remittances = await this.remittanceRepository.find({ where: { tenantId } });
    const totalPaymentAmount = remittances.reduce((sum, r) => sum + r.totalPaymentAmount, 0);
    const totalPosted = remittances.filter((r) => r.status === RemittanceStatus.POSTED).length;
    const totalPending = remittances.filter(
      (r) => r.status === RemittanceStatus.IMPORTED || r.status === RemittanceStatus.PARTIALLY_POSTED,
    ).length;

    const claims = await this.remittanceClaimRepository.find({ where: { tenantId } });
    const unmatchedClaimCount = claims.filter((c) => !c.isMatched).length;
    const deniedClaimCount = claims.filter((c) => c.claimStatusCode === '4').length;

    return {
      totalRemittances: remittances.length,
      totalPosted,
      totalPending,
      totalPaymentAmount,
      totalClaimCount: claims.length,
      unmatchedClaimCount,
      deniedClaimCount,
    };
  }
}
