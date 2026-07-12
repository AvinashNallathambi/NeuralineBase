import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PayerContract } from './entities/payer-contract.entity';
import { UnderpaymentRecord, UnderpaymentStatus } from './entities/underpayment-record.entity';
import { RemittanceClaim } from '../remittance/entities/remittance-claim.entity';
import { RemittanceServiceLine } from '../remittance/entities/remittance-service-line.entity';
import { Remittance } from '../remittance/entities/remittance.entity';
import { EncounterClaim } from '../billing/entities/encounter-claim.entity';

@Injectable()
export class UnderpaymentsService {
  private readonly logger = new Logger(UnderpaymentsService.name);

  constructor(
    @InjectRepository(PayerContract)
    private readonly contractRepository: Repository<PayerContract>,
    @InjectRepository(UnderpaymentRecord)
    private readonly underpaymentRepository: Repository<UnderpaymentRecord>,
    @InjectRepository(RemittanceClaim)
    private readonly remittanceClaimRepository: Repository<RemittanceClaim>,
    @InjectRepository(RemittanceServiceLine)
    private readonly serviceLineRepository: Repository<RemittanceServiceLine>,
    @InjectRepository(Remittance)
    private readonly remittanceRepository: Repository<Remittance>,
    @InjectRepository(EncounterClaim)
    private readonly claimRepository: Repository<EncounterClaim>,
  ) {}

  // ─── Contract Management ───────────────────────────────────────────

  async createContract(data: Partial<PayerContract>, tenantId: string): Promise<PayerContract> {
    const contract = new PayerContract();
    contract.tenantId = tenantId;
    contract.payerId = data.payerId || null;
    contract.payerName = data.payerName || '';
    contract.cptCode = data.cptCode || '';
    contract.cptDescription = data.cptDescription || null;
    contract.contractedRate = data.contractedRate || 0;
    contract.rateType = data.rateType || 'flat';
    contract.medicarePercentage = data.medicarePercentage || null;
    contract.modifierAdjustments = data.modifierAdjustments || {};
    contract.effectiveDate = data.effectiveDate || null;
    contract.expirationDate = data.expirationDate || null;
    contract.isActive = data.isActive ?? true;
    return this.contractRepository.save(contract);
  }

  async findAllContracts(tenantId: string, payerName?: string): Promise<PayerContract[]> {
    const where: any = { tenantId, isActive: true };
    if (payerName) where.payerName = payerName;
    return this.contractRepository.find({ where, order: { payerName: 'ASC', cptCode: 'ASC' } });
  }

  async findContract(tenantId: string, payerName: string, cptCode: string): Promise<PayerContract | null> {
    return this.contractRepository.findOne({
      where: { tenantId, payerName, cptCode, isActive: true },
    });
  }

  // ─── Expected Payment Calculator ───────────────────────────────────

  async calculateExpectedPayment(
    tenantId: string,
    payerName: string,
    cptCode: string,
    units: number,
    modifiers?: string[],
  ): Promise<{ expected: number; contract: PayerContract | null }> {
    const contract = await this.findContract(tenantId, payerName, cptCode);
    if (!contract) {
      return { expected: 0, contract: null };
    }

    let expected = contract.contractedRate * units;

    // Apply modifier adjustments
    if (modifiers && contract.modifierAdjustments) {
      for (const mod of modifiers) {
        const adjustment = contract.modifierAdjustments[mod];
        if (adjustment != null) {
          expected *= adjustment;
        }
      }
    }

    return { expected, contract };
  }

  // ─── Underpayment Detection ────────────────────────────────────────

  async detectUnderpayments(remittanceId: string, tenantId: string): Promise<{
    detectedCount: number;
    totalVariance: number;
  }> {
    this.logger.log(`Detecting underpayments for remittance ${remittanceId}`);

    const claims = await this.remittanceClaimRepository.find({
      where: { remittanceId, tenantId },
    });

    let detectedCount = 0;
    let totalVariance = 0;

    for (const claim of claims) {
      // Skip denied claims
      if (claim.claimStatusCode === '4') continue;

      // Get payer name from the remittance
      const remittance = await this.remittanceRepository.findOne({ where: { id: claim.remittanceId } });
      const payerName = remittance?.payerName || 'Unknown';

      const serviceLines = await this.serviceLineRepository.find({
        where: { remittanceClaimId: claim.id, tenantId },
      });

      for (const sl of serviceLines) {

        const { expected, contract } = await this.calculateExpectedPayment(
          tenantId,
          payerName,
          sl.cptCode,
          sl.units,
          [sl.modifier1, sl.modifier2, sl.modifier3, sl.modifier4].filter(Boolean) as string[],
        );

        if (!contract || expected === 0) continue; // No contract rate available

        const variance = expected - sl.paidAmount;
        const variancePercentage = expected > 0 ? (variance / expected) * 100 : 0;

        // Flag as underpayment if variance > $5 and > 2% of expected
        if (variance > 5 && variancePercentage > 2) {
          // Check if already detected
          const existing = await this.underpaymentRepository.findOne({
            where: { serviceLineId: sl.id, tenantId },
          });
          if (existing) continue;

          const record = new UnderpaymentRecord();
          record.tenantId = tenantId;
          record.claimId = claim.matchedClaimId || null;
          record.claimNumber = claim.matchedClaimNumber || null;
          record.remittanceClaimId = claim.id;
          record.serviceLineId = sl.id;
          record.payerName = payerName;
          record.cptCode = sl.cptCode;
          record.billedAmount = sl.billedAmount;
          record.expectedAmount = expected;
          record.actualPaidAmount = sl.paidAmount;
          record.varianceAmount = variance;
          record.variancePercentage = variancePercentage;
          record.contractId = contract.id;
          record.contractedRate = contract.contractedRate;
          record.status = UnderpaymentStatus.DETECTED;
          record.patientName = claim.patientName || null;
          record.serviceDate = sl.serviceDate || claim.serviceDate || null;
          record.paymentDate = claim.postedAt || null;

          await this.underpaymentRepository.save(record);
          detectedCount++;
          totalVariance += variance;
        }
      }
    }

    this.logger.log(`Detected ${detectedCount} underpayments, total variance: $${totalVariance.toFixed(2)}`);
    return { detectedCount, totalVariance };
  }

  // ─── Queries ───────────────────────────────────────────────────────

  async findAll(tenantId: string, status?: UnderpaymentStatus): Promise<UnderpaymentRecord[]> {
    const where: any = { tenantId };
    if (status) where.status = status;
    return this.underpaymentRepository.find({
      where,
      order: { varianceAmount: 'DESC' },
    });
  }

  async findOne(id: string): Promise<UnderpaymentRecord> {
    const record = await this.underpaymentRepository.findOne({ where: { id } });
    if (!record) throw new NotFoundException(`Underpayment record ${id} not found`);
    return record;
  }

  async updateStatus(
    id: string,
    status: UnderpaymentStatus,
    recoveredAmount?: number,
    notes?: string,
  ): Promise<UnderpaymentRecord> {
    const record = await this.findOne(id);
    record.status = status;
    if (recoveredAmount != null) record.recoveredAmount = recoveredAmount;
    if (notes) record.resolutionNotes = notes;
    if (status === UnderpaymentStatus.RECOVERED || status === UnderpaymentStatus.WRITTEN_OFF || status === UnderpaymentStatus.FALSE_POSITIVE) {
      record.resolvedAt = new Date();
    }
    return this.underpaymentRepository.save(record);
  }

  // ─── Analytics ─────────────────────────────────────────────────────

  async getStats(tenantId: string): Promise<{
    totalUnderpayments: number;
    totalVariance: number;
    totalRecovered: number;
    detectedCount: number;
    investigatingCount: number;
    disputedCount: number;
    recoveredCount: number;
    byPayer: { payer: string; count: number; variance: number; recovered: number }[];
    byCptCode: { cptCode: string; count: number; variance: number }[];
  }> {
    const records = await this.underpaymentRepository.find({ where: { tenantId } });

    const totalVariance = records.reduce((sum, r) => sum + r.varianceAmount, 0);
    const totalRecovered = records
      .filter((r) => r.recoveredAmount != null)
      .reduce((sum, r) => sum + (r.recoveredAmount || 0), 0);

    // By payer
    const payerMap = new Map<string, { count: number; variance: number; recovered: number }>();
    for (const r of records) {
      const existing = payerMap.get(r.payerName) || { count: 0, variance: 0, recovered: 0 };
      existing.count++;
      existing.variance += r.varianceAmount;
      existing.recovered += r.recoveredAmount || 0;
      payerMap.set(r.payerName, existing);
    }
    const byPayer = Array.from(payerMap.entries())
      .map(([payer, val]) => ({ payer, ...val }))
      .sort((a, b) => b.variance - a.variance);

    // By CPT code
    const cptMap = new Map<string, { count: number; variance: number }>();
    for (const r of records) {
      const existing = cptMap.get(r.cptCode) || { count: 0, variance: 0 };
      existing.count++;
      existing.variance += r.varianceAmount;
      cptMap.set(r.cptCode, existing);
    }
    const byCptCode = Array.from(cptMap.entries())
      .map(([cptCode, val]) => ({ cptCode, ...val }))
      .sort((a, b) => b.variance - a.variance);

    return {
      totalUnderpayments: records.length,
      totalVariance,
      totalRecovered,
      detectedCount: records.filter((r) => r.status === UnderpaymentStatus.DETECTED).length,
      investigatingCount: records.filter((r) => r.status === UnderpaymentStatus.INVESTIGATING).length,
      disputedCount: records.filter((r) => r.status === UnderpaymentStatus.DISPUTED).length,
      recoveredCount: records.filter((r) => r.status === UnderpaymentStatus.RECOVERED).length,
      byPayer,
      byCptCode,
    };
  }
}
