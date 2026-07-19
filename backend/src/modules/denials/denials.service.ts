import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, Not, IsNull } from 'typeorm';
import { DenialRecord, DenialRootCause, DenialPriority, DenialWorklistStatus } from './entities/denial-record.entity';
import { DenialCategoryEngine } from './denial-category-engine';
import { ClaimAdjustment } from '../remittance/entities/claim-adjustment.entity';
import { RemittanceClaim } from '../remittance/entities/remittance-claim.entity';
import { Remittance } from '../remittance/entities/remittance.entity';
import { EncounterClaim } from '../billing/entities/encounter-claim.entity';
import { CarcCode } from '../remittance/entities/carc-code.entity';
import { RarcCode } from '../remittance/entities/rarc-code.entity';

@Injectable()
export class DenialsService {
  private readonly logger = new Logger(DenialsService.name);

  constructor(
    @InjectRepository(DenialRecord)
    private readonly denialRepository: Repository<DenialRecord>,
    @InjectRepository(ClaimAdjustment)
    private readonly adjustmentRepository: Repository<ClaimAdjustment>,
    @InjectRepository(RemittanceClaim)
    private readonly remittanceClaimRepository: Repository<RemittanceClaim>,
    @InjectRepository(Remittance)
    private readonly remittanceRepository: Repository<Remittance>,
    @InjectRepository(EncounterClaim)
    private readonly claimRepository: Repository<EncounterClaim>,
    @InjectRepository(CarcCode)
    private readonly carcRepository: Repository<CarcCode>,
    @InjectRepository(RarcCode)
    private readonly rarcRepository: Repository<RarcCode>,
    private readonly categoryEngine: DenialCategoryEngine,
  ) {}

  // ─── Auto-generate denials from remittance adjustments ─────────────

  async generateFromRemittance(remittanceId: string, tenantId: string): Promise<number> {
    this.logger.log(`Generating denial records from remittance ${remittanceId}`);

    // Load the remittance to get payer info (previously payerName was hardcoded to null)
    const remittance = await this.remittanceRepository.findOne({
      where: { id: remittanceId, tenantId },
    });
    const payerName = remittance?.payerName || null;
    const payerId = remittance?.payerId || null;

    // Get all adjustments for this remittance's claims (excluding PR - patient responsibility)
    const remittanceClaims = await this.remittanceClaimRepository.find({
      where: { remittanceId, tenantId },
    });

    let count = 0;
    for (const rc of remittanceClaims) {
      // Only process denied claims (status code 4) or claims with adjustments
      const adjustments = await this.adjustmentRepository.find({
        where: { remittanceClaimId: rc.id, tenantId },
      });

      // Filter to denial adjustments (non-PR group codes)
      const denialAdjustments = adjustments.filter((a) => a.groupCode !== 'PR');

      if (denialAdjustments.length === 0) continue;

      for (const adj of denialAdjustments) {
        // Check if denial record already exists for this adjustment
        const existing = await this.denialRepository.findOne({
          where: { adjustmentId: adj.id, tenantId },
        });
        if (existing) continue;

        const rootCause = this.categoryEngine.categorize(adj.carcCode, adj.rarcCode, adj.groupCode);
        const deniedAmount = adj.adjustmentAmount;

        // Get claim info
        let claim: EncounterClaim | null = null;
        if (rc.matchedClaimId) {
          claim = await this.claimRepository.findOne({ where: { id: rc.matchedClaimId } });
        }

        // Calculate filing deadline (typically 90-180 days from denial, varies by payer)
        const denialDate = rc.postedAt || new Date();
        const filingDeadline = new Date(denialDate);
        filingDeadline.setDate(filingDeadline.getDate() + 90); // Default 90 days

        const priority = this.categoryEngine.calculatePriority(rootCause, deniedAmount, filingDeadline);

        const denial = new DenialRecord();
        denial.tenantId = tenantId;
        denial.claimId = rc.matchedClaimId || null;
        denial.claimNumber = rc.matchedClaimNumber || claim?.claimNumber || null;
        denial.remittanceClaimId = rc.id;
        denial.adjustmentId = adj.id;
        denial.patientId = rc.patientId || claim?.patientId || null;
        denial.patientName = rc.patientName || claim?.patientName || null;
        // FIX: populate payer info from the remittance (was hardcoded to null)
        denial.payerName = payerName;
        denial.payerId = payerId;
        denial.carcCode = adj.carcCode;
        denial.carcDescription = adj.carcDescription;
        denial.rarcCode = adj.rarcCode || null;
        denial.rarcDescription = adj.rarcDescription || null;
        denial.groupCode = adj.groupCode;
        denial.rootCauseCategory = rootCause;
        denial.deniedAmount = deniedAmount;
        denial.billedAmount = rc.billedAmount;
        denial.paidAmount = rc.paidAmount;
        denial.denialDate = denialDate;
        denial.serviceDate = rc.serviceDate || null;
        denial.filingDeadline = filingDeadline;
        denial.priority = priority as DenialPriority;
        denial.status = DenialWorklistStatus.NEW;
        denial.denialReasonText = `${adj.groupCode}-${adj.carcCode}: ${adj.carcDescription || ''}`;
        denial.serviceLineId = adj.serviceLineId || null;

        await this.denialRepository.save(denial);
        count++;
      }
    }

    this.logger.log(`Generated ${count} denial records from remittance ${remittanceId}`);
    return count;
  }

  // ─── Worklist ──────────────────────────────────────────────────────

  async getWorklist(
    tenantId: string,
    filters?: {
      status?: DenialWorklistStatus;
      priority?: DenialPriority;
      rootCause?: DenialRootCause;
      assignedTo?: string;
      payerName?: string;
    },
  ): Promise<DenialRecord[]> {
    const where: any = { tenantId };
    if (filters?.status) where.status = filters.status;
    if (filters?.priority) where.priority = filters.priority;
    if (filters?.rootCause) where.rootCauseCategory = filters.rootCause;
    if (filters?.assignedTo) where.assignedTo = filters.assignedTo;
    if (filters?.payerName) where.payerName = filters.payerName;

    return this.denialRepository.find({
      where,
      order: { priority: 'DESC', deniedAmount: 'DESC', filingDeadline: 'ASC' },
    });
  }

  async findOne(id: string): Promise<DenialRecord> {
    const denial = await this.denialRepository.findOne({ where: { id } });
    if (!denial) throw new NotFoundException(`Denial record ${id} not found`);
    return denial;
  }

  async updateStatus(
    id: string,
    status: DenialWorklistStatus,
    resolutionNotes?: string,
  ): Promise<DenialRecord> {
    const denial = await this.findOne(id);
    denial.status = status;
    if (resolutionNotes) {
      denial.resolutionNotes = resolutionNotes;
    }
    if (status === DenialWorklistStatus.RESOLVED || status === DenialWorklistStatus.WRITTEN_OFF) {
      denial.resolvedAt = new Date();
    }
    return this.denialRepository.save(denial);
  }

  async assign(id: string, assignedTo: string, assignedName: string): Promise<DenialRecord> {
    const denial = await this.findOne(id);
    denial.assignedTo = assignedTo;
    denial.assignedName = assignedName;
    if (denial.status === DenialWorklistStatus.NEW) {
      denial.status = DenialWorklistStatus.IN_PROGRESS;
    }
    return this.denialRepository.save(denial);
  }

  async setRecoveryPrediction(
    id: string,
    probability: number,
    estimatedRecovery: number,
  ): Promise<DenialRecord> {
    const denial = await this.findOne(id);
    denial.recoveryProbability = probability;
    denial.estimatedRecovery = estimatedRecovery;
    return this.denialRepository.save(denial);
  }

  // ─── Analytics ─────────────────────────────────────────────────────

  async getAnalytics(
    tenantId: string,
    dateFrom?: Date,
    dateTo?: Date,
  ): Promise<{
    totalDenials: number;
    totalDeniedAmount: number;
    byRootCause: { category: string; count: number; amount: number }[];
    byPayer: { payer: string; count: number; amount: number; denialRate: number }[];
    byPriority: { priority: string; count: number; amount: number }[];
    byStatus: { status: string; count: number; amount: number }[];
    byMonth: { month: string; count: number; amount: number }[];
    topCarcCodes: { code: string; description: string; count: number; amount: number }[];
    appealSuccessRate: number;
    recoveryRate: number;
    avgDaysToResolve: number;
  }> {
    const where: any = { tenantId };
    if (dateFrom && dateTo) {
      where.denialDate = Between(dateFrom, dateTo);
    }

    const denials = await this.denialRepository.find({ where });

    const totalDenials = denials.length;
    const totalDeniedAmount = denials.reduce((sum, d) => sum + d.deniedAmount, 0);

    // By root cause
    const rootCauseMap = new Map<string, { count: number; amount: number }>();
    for (const d of denials) {
      const key = d.rootCauseCategory;
      const existing = rootCauseMap.get(key) || { count: 0, amount: 0 };
      existing.count++;
      existing.amount += d.deniedAmount;
      rootCauseMap.set(key, existing);
    }
    const byRootCause = Array.from(rootCauseMap.entries())
      .map(([category, val]) => ({
        category: this.categoryEngine.getLabel(category as DenialRootCause),
        count: val.count,
        amount: val.amount,
      }))
      .sort((a, b) => b.amount - a.amount);

    // By payer
    const payerMap = new Map<string, { count: number; amount: number }>();
    for (const d of denials) {
      const key = d.payerName || 'Unknown';
      const existing = payerMap.get(key) || { count: 0, amount: 0 };
      existing.count++;
      existing.amount += d.deniedAmount;
      payerMap.set(key, existing);
    }
    const byPayer = Array.from(payerMap.entries())
      .map(([payer, val]) => ({
        payer,
        count: val.count,
        amount: val.amount,
        denialRate: 0, // Would need total claims per payer to calculate
      }))
      .sort((a, b) => b.amount - a.amount);

    // By priority
    const priorityMap = new Map<string, { count: number; amount: number }>();
    for (const d of denials) {
      const key = d.priority;
      const existing = priorityMap.get(key) || { count: 0, amount: 0 };
      existing.count++;
      existing.amount += d.deniedAmount;
      priorityMap.set(key, existing);
    }
    const byPriority = Array.from(priorityMap.entries()).map(([priority, val]) => ({
      priority,
      count: val.count,
      amount: val.amount,
    }));

    // By status
    const statusMap = new Map<string, { count: number; amount: number }>();
    for (const d of denials) {
      const key = d.status;
      const existing = statusMap.get(key) || { count: 0, amount: 0 };
      existing.count++;
      existing.amount += d.deniedAmount;
      statusMap.set(key, existing);
    }
    const byStatus = Array.from(statusMap.entries()).map(([status, val]) => ({
      status,
      count: val.count,
      amount: val.amount,
    }));

    // By month
    const monthMap = new Map<string, { count: number; amount: number }>();
    for (const d of denials) {
      if (!d.denialDate) continue;
      const month = new Date(d.denialDate).toISOString().slice(0, 7); // YYYY-MM
      const existing = monthMap.get(month) || { count: 0, amount: 0 };
      existing.count++;
      existing.amount += d.deniedAmount;
      monthMap.set(month, existing);
    }
    const byMonth = Array.from(monthMap.entries())
      .map(([month, val]) => ({ month, count: val.count, amount: val.amount }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Top CARC codes
    const carcMap = new Map<string, { description: string; count: number; amount: number }>();
    for (const d of denials) {
      const existing = carcMap.get(d.carcCode) || {
        description: d.carcDescription || d.carcCode,
        count: 0,
        amount: 0,
      };
      existing.count++;
      existing.amount += d.deniedAmount;
      carcMap.set(d.carcCode, existing);
    }
    const topCarcCodes = Array.from(carcMap.entries())
      .map(([code, val]) => ({ code, description: val.description, count: val.count, amount: val.amount }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Appeal success rate
    const appealed = denials.filter((d) => d.status === DenialWorklistStatus.APPEALED || d.status === DenialWorklistStatus.RESOLVED);
    const resolved = denials.filter((d) => d.status === DenialWorklistStatus.RESOLVED);
    const appealSuccessRate = appealed.length > 0 ? (resolved.length / appealed.length) * 100 : 0;

    // Recovery rate
    const recoveredAmount = denials
      .filter((d) => d.status === DenialWorklistStatus.RESOLVED)
      .reduce((sum, d) => sum + (d.estimatedRecovery || 0), 0);
    const recoveryRate = totalDeniedAmount > 0 ? (recoveredAmount / totalDeniedAmount) * 100 : 0;

    // Avg days to resolve
    const resolvedWithDates = denials.filter((d) => d.resolvedAt && d.denialDate);
    const avgDaysToResolve =
      resolvedWithDates.length > 0
        ? resolvedWithDates.reduce((sum, d) => {
            const days = Math.floor(
              (d.resolvedAt!.getTime() - new Date(d.denialDate!).getTime()) / (1000 * 60 * 60 * 24),
            );
            return sum + days;
          }, 0) / resolvedWithDates.length
        : 0;

    return {
      totalDenials,
      totalDeniedAmount,
      byRootCause,
      byPayer,
      byPriority,
      byStatus,
      byMonth,
      topCarcCodes,
      appealSuccessRate,
      recoveryRate,
      avgDaysToResolve,
    };
  }

  // ─── Claim Aging ───────────────────────────────────────────────────

  async getClaimAging(tenantId: string): Promise<{
    buckets: { bucket: string; count: number; amount: number }[];
    byPayer: { payer: string; buckets: { bucket: string; count: number; amount: number }[] }[];
  }> {
    const denials = await this.denialRepository.find({
      where: {
        tenantId,
        status: Not(DenialWorklistStatus.RESOLVED),
      },
    });

    const now = Date.now();
    const bucketNames = ['0-30', '31-60', '61-90', '91-120', '120+'];
    const buckets = bucketNames.map((b) => ({ bucket: b, count: 0, amount: 0 }));

    for (const d of denials) {
      if (!d.denialDate) continue;
      const days = Math.floor((now - new Date(d.denialDate).getTime()) / (1000 * 60 * 60 * 24));
      let bucketIdx: number;
      if (days <= 30) bucketIdx = 0;
      else if (days <= 60) bucketIdx = 1;
      else if (days <= 90) bucketIdx = 2;
      else if (days <= 120) bucketIdx = 3;
      else bucketIdx = 4;

      buckets[bucketIdx].count++;
      buckets[bucketIdx].amount += d.deniedAmount;
    }

    // By payer aging
    const payerMap = new Map<string, typeof buckets>();
    for (const d of denials) {
      const payer = d.payerName || 'Unknown';
      if (!payerMap.has(payer)) {
        payerMap.set(payer, bucketNames.map((b) => ({ bucket: b, count: 0, amount: 0 })));
      }
      if (!d.denialDate) continue;
      const days = Math.floor((now - new Date(d.denialDate).getTime()) / (1000 * 60 * 60 * 24));
      let bucketIdx: number;
      if (days <= 30) bucketIdx = 0;
      else if (days <= 60) bucketIdx = 1;
      else if (days <= 90) bucketIdx = 2;
      else if (days <= 120) bucketIdx = 3;
      else bucketIdx = 4;

      payerMap.get(payer)![bucketIdx].count++;
      payerMap.get(payer)![bucketIdx].amount += d.deniedAmount;
    }

    const byPayer = Array.from(payerMap.entries()).map(([payer, b]) => ({ payer, buckets: b }));

    return { buckets, byPayer };
  }

  // ─── Payer Performance ─────────────────────────────────────────────

  async getPayerPerformance(tenantId: string): Promise<
    {
      payer: string;
      totalDenials: number;
      deniedAmount: number;
      resolvedCount: number;
      avgDaysToResolve: number;
      topRootCause: string;
    }[]
  > {
    const denials = await this.denialRepository.find({ where: { tenantId } });

    const payerMap = new Map<
      string,
      {
        totalDenials: number;
        deniedAmount: number;
        resolvedCount: number;
        totalDays: number;
        rootCauses: Map<string, number>;
      }
    >();

    for (const d of denials) {
      const payer = d.payerName || 'Unknown';
      const existing = payerMap.get(payer) || {
        totalDenials: 0,
        deniedAmount: 0,
        resolvedCount: 0,
        totalDays: 0,
        rootCauses: new Map<string, number>(),
      };
      existing.totalDenials++;
      existing.deniedAmount += d.deniedAmount;
      if (d.status === DenialWorklistStatus.RESOLVED) {
        existing.resolvedCount++;
        if (d.resolvedAt && d.denialDate) {
          existing.totalDays += Math.floor(
            (d.resolvedAt.getTime() - new Date(d.denialDate).getTime()) / (1000 * 60 * 60 * 24),
          );
        }
      }
      const rc = d.rootCauseCategory;
      existing.rootCauses.set(rc, (existing.rootCauses.get(rc) || 0) + 1);
      payerMap.set(payer, existing);
    }

    return Array.from(payerMap.entries())
      .map(([payer, val]) => {
        const topRootCause = Array.from(val.rootCauses.entries()).sort((a, b) => b[1] - a[1])[0];
        return {
          payer,
          totalDenials: val.totalDenials,
          deniedAmount: val.deniedAmount,
          resolvedCount: val.resolvedCount,
          avgDaysToResolve: val.resolvedCount > 0 ? val.totalDays / val.resolvedCount : 0,
          topRootCause: topRootCause ? this.categoryEngine.getLabel(topRootCause[0] as DenialRootCause) : '-',
        };
      })
      .sort((a, b) => b.deniedAmount - a.deniedAmount);
  }

  // ─── Stats ─────────────────────────────────────────────────────────

  async getStats(tenantId: string): Promise<{
    totalDenials: number;
    totalDeniedAmount: number;
    newCount: number;
    inProgressCount: number;
    appealedCount: number;
    resolvedCount: number;
    criticalCount: number;
    approachingDeadlineCount: number;
    avgRecoveryProbability: number;
  }> {
    const denials = await this.denialRepository.find({ where: { tenantId } });

    const now = Date.now();
    const sevenDaysFromNow = new Date(now + 7 * 24 * 60 * 60 * 1000);

    const approachingDeadline = denials.filter(
      (d) => d.filingDeadline && d.filingDeadline <= sevenDaysFromNow && d.status !== DenialWorklistStatus.RESOLVED,
    );

    const recoveryProbs = denials.filter((d) => d.recoveryProbability != null);

    return {
      totalDenials: denials.length,
      totalDeniedAmount: denials.reduce((sum, d) => sum + d.deniedAmount, 0),
      newCount: denials.filter((d) => d.status === DenialWorklistStatus.NEW).length,
      inProgressCount: denials.filter((d) => d.status === DenialWorklistStatus.IN_PROGRESS).length,
      appealedCount: denials.filter((d) => d.status === DenialWorklistStatus.APPEALED).length,
      resolvedCount: denials.filter((d) => d.status === DenialWorklistStatus.RESOLVED).length,
      criticalCount: denials.filter((d) => d.priority === DenialPriority.CRITICAL).length,
      approachingDeadlineCount: approachingDeadline.length,
      avgRecoveryProbability:
        recoveryProbs.length > 0
          ? recoveryProbs.reduce((sum, d) => sum + (d.recoveryProbability || 0), 0) / recoveryProbs.length
          : 0,
    };
  }
}
