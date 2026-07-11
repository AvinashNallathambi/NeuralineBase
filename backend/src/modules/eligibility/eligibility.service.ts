import { Injectable, NotFoundException, ForbiddenException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InsuranceVerification, VerificationStatus, VerificationType, CoverageStatus } from './entities/insurance-verification.entity';
import { PatientInsurance } from '../billing/entities/patient-insurance.entity';
import { CreateInsuranceVerificationDto } from './dto/create-insurance-verification.dto';
import { UpdateInsuranceVerificationDto } from './dto/update-insurance-verification.dto';
import { QueryInsuranceVerificationDto } from './dto/query-insurance-verification.dto';
import { CoverageSummaryDto } from './dto/coverage-summary.dto';
import { EligibilityProvider, EligibilityRequest, ELIGIBILITY_PROVIDER } from './providers/eligibility-provider.interface';
import { HipaaAuditService } from '../../common/services/hipaa-audit.service';

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class EligibilityService {
  constructor(
    @InjectRepository(InsuranceVerification)
    private readonly verificationRepo: Repository<InsuranceVerification>,
    @InjectRepository(PatientInsurance)
    private readonly insuranceRepo: Repository<PatientInsurance>,
    @Inject(ELIGIBILITY_PROVIDER)
    private readonly provider: EligibilityProvider,
    private readonly auditService: HipaaAuditService,
  ) {}

  private toCoverageSummary(v: InsuranceVerification): CoverageSummaryDto {
    return {
      id: v.id,
      patientId: v.patientId,
      appointmentId: v.appointmentId,
      status: v.status,
      coverageStatus: v.coverageStatus,
      payerName: v.payerName,
      providerName: v.providerName,
      policyNumber: v.policyNumber,
      groupNumber: v.groupNumber,
      planName: v.planName,
      planType: v.planType,
      network: v.network,
      subscriberName: v.subscriberName,
      subscriberRelation: v.subscriberRelation,
      patientName: v.patientName,
      effectiveDate: v.effectiveDate ? new Date(v.effectiveDate).toISOString().split('T')[0] : null,
      expirationDate: v.expirationDate ? new Date(v.expirationDate).toISOString().split('T')[0] : null,
      deductibleIndividual: v.deductibleIndividual,
      deductibleFamily: v.deductibleFamily,
      deductibleRemaining: v.deductibleRemaining,
      outOfPocketIndividual: v.outOfPocketIndividual,
      outOfPocketFamily: v.outOfPocketFamily,
      outOfPocketRemaining: v.outOfPocketRemaining,
      copayAmount: v.copayAmount,
      coinsurancePercentage: v.coinsurancePercentage,
      authorizationRequired: v.authorizationRequired,
      referralRequired: v.referralRequired,
      benefitLimitations: v.benefitLimitations,
      benefits: v.benefits,
      verifiedAt: v.verifiedAt ? new Date(v.verifiedAt).toISOString() : null,
      verifiedByName: v.verifiedByName,
      errorCode: v.errorDetails?.errorCode as string | null,
      errorMessage: v.errorDetails?.errorMessage as string | null,
    };
  }

  private async resolveInsurance(
    tenantId: string,
    dto: { patientInsuranceId?: string; patientId?: string },
  ): Promise<PatientInsurance | null> {
    if (dto.patientInsuranceId) {
      return this.insuranceRepo.findOne({
        where: { id: dto.patientInsuranceId, tenantId },
        relations: ['payer'],
      });
    }
    if (dto.patientId) {
      return this.insuranceRepo.findOne({
        where: { patientId: dto.patientId, tenantId, status: 'active' },
        order: { priority: 'ASC' },
        relations: ['payer'],
      });
    }
    return null;
  }

  async findAll(tenantId: string, query: QueryInsuranceVerificationDto): Promise<PaginatedResult<InsuranceVerification>> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const qb = this.verificationRepo
      .createQueryBuilder('v')
      .leftJoinAndSelect('v.patientInsurance', 'insurance')
      .where('v.tenantId = :tenantId', { tenantId })
      .andWhere('v.deletedAt IS NULL');

    if (query.patientId) qb.andWhere('v.patientId = :patientId', { patientId: query.patientId });
    if (query.appointmentId) qb.andWhere('v.appointmentId = :appointmentId', { appointmentId: query.appointmentId });
    if (query.status) qb.andWhere('v.status = :status', { status: query.status });
    if (query.serviceType) qb.andWhere('v.serviceType = :serviceType', { serviceType: query.serviceType });
    if (query.verifiedFrom) qb.andWhere('v.verifiedAt >= :verifiedFrom', { verifiedFrom: new Date(query.verifiedFrom) });
    if (query.verifiedTo) qb.andWhere('v.verifiedAt <= :verifiedTo', { verifiedTo: new Date(query.verifiedTo) });
    if (query.search) {
      qb.andWhere(
        '(v.payerName ILIKE :search OR v.policyNumber ILIKE :search OR v.providerName ILIKE :search OR v.patientName ILIKE :search OR v.planName ILIKE :search OR v.subscriberName ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    const allowedSort = ['createdAt', 'verifiedAt', 'status', 'payerName'];
    const sortBy = allowedSort.includes(query.sortBy || '') ? query.sortBy : 'createdAt';
    const sortOrder = query.sortOrder === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(`v.${sortBy}`, sortOrder);

    const [data, total] = await qb.skip(skip).take(limit).getManyAndCount();

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(tenantId: string, id: string): Promise<InsuranceVerification> {
    const v = await this.verificationRepo.findOne({
      where: { id, tenantId },
      relations: ['patientInsurance', 'patientInsurance.payer'],
    });
    if (!v) throw new NotFoundException('Verification not found');
    return v;
  }

  async findLatestByPatient(tenantId: string, patientId: string): Promise<CoverageSummaryDto | null> {
    const v = await this.verificationRepo.findOne({
      where: { tenantId, patientId },
      order: { verifiedAt: 'DESC', createdAt: 'DESC' },
    });
    return v ? this.toCoverageSummary(v) : null;
  }

  async findHistoryByPatient(tenantId: string, patientId: string, query: QueryInsuranceVerificationDto): Promise<PaginatedResult<InsuranceVerification>> {
    return this.findAll(tenantId, { ...query, patientId });
  }

  async create(tenantId: string, dto: CreateInsuranceVerificationDto, actorId: string, actorName: string, actorRole: string): Promise<InsuranceVerification> {
    const insurance = await this.resolveInsurance(tenantId, dto);
    const verification = this.verificationRepo.create({
      tenantId,
      patientId: dto.patientId,
      appointmentId: dto.appointmentId || null,
      patientInsuranceId: insurance?.id || dto.patientInsuranceId || null,
      insurancePayerId: insurance?.insurancePayerId || dto.insurancePayerId || null,
      verificationType: dto.verificationType || VerificationType.REALTIME,
      serviceType: dto.serviceType || '30',
      policyNumber: dto.policyNumber || insurance?.policyNumber || null,
      groupNumber: dto.groupNumber || insurance?.groupNumber || null,
      payerName: insurance?.payer?.name || null,
      providerName: null,
      status: VerificationStatus.PENDING,
      coverageStatus: CoverageStatus.UNKNOWN,
      metadata: dto.metadata || {},
      notes: dto.notes || null,
    });

    const saved = await this.verificationRepo.save(verification);
    await this.runVerification(saved, tenantId, insurance, actorId, actorName);

    await this.auditService.logPhiAccess(
      actorId,
      actorName,
      actorRole,
      tenantId,
      'InsuranceVerification',
      saved.id,
      'CREATE',
      { patientId: dto.patientId },
    );

    return this.findOne(tenantId, saved.id);
  }

  async rerun(tenantId: string, id: string, actorId: string, actorName: string, actorRole: string): Promise<InsuranceVerification> {
    const v = await this.findOne(tenantId, id);
    const insurance = v.patientInsurance || (v.patientInsuranceId ? await this.resolveInsurance(tenantId, { patientInsuranceId: v.patientInsuranceId }) : null);
    await this.runVerification(v, tenantId, insurance, actorId, actorName);

    await this.auditService.logPhiAccess(
      actorId,
      actorName,
      actorRole,
      tenantId,
      'InsuranceVerification',
      v.id,
      'UPDATE',
      { action: 'rerun' },
    );

    return this.findOne(tenantId, id);
  }

  async update(tenantId: string, id: string, dto: UpdateInsuranceVerificationDto, actorId: string, actorName: string, actorRole: string): Promise<InsuranceVerification> {
    const v = await this.findOne(tenantId, id);
    if (dto.notes !== undefined) v.notes = dto.notes;
    if (dto.metadata !== undefined) v.metadata = dto.metadata;
    if (dto.appointmentId !== undefined) v.appointmentId = dto.appointmentId || null;
    if (dto.serviceType !== undefined) v.serviceType = dto.serviceType;
    const updated = await this.verificationRepo.save(v);

    await this.auditService.logPhiAccess(
      actorId,
      actorName,
      actorRole,
      tenantId,
      'InsuranceVerification',
      id,
      'UPDATE',
      { changedFields: Object.keys(dto) },
    );

    return updated;
  }

  async remove(tenantId: string, id: string, actorId: string, actorName: string, actorRole: string): Promise<void> {
    const v = await this.findOne(tenantId, id);
    await this.verificationRepo.softRemove(v);

    await this.auditService.logPhiAccess(
      actorId,
      actorName,
      actorRole,
      tenantId,
      'InsuranceVerification',
      id,
      'DELETE',
    );
  }

  async coverageSummary(tenantId: string, patientId: string): Promise<CoverageSummaryDto | null> {
    return this.findLatestByPatient(tenantId, patientId);
  }

  async getCounts(tenantId: string): Promise<Record<string, number>> {
    const qb = this.verificationRepo
      .createQueryBuilder('v')
      .select('v.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('v.tenantId = :tenantId', { tenantId })
      .andWhere('v.deletedAt IS NULL')
      .groupBy('v.status');

    const rows = await qb.getRawMany<{ status: string; count: string }>();
    const counts: Record<string, number> = { total: 0, active: 0, pending: 0, inactive: 0, failed: 0, error: 0 };
    for (const row of rows) {
      counts[row.status] = parseInt(row.count, 10);
      counts.total += parseInt(row.count, 10);
    }
    return counts;
  }

  async batchVerify(
    tenantId: string,
    patientIds: string[],
    actorId: string,
    actorName: string,
    actorRole: string,
  ): Promise<InsuranceVerification[]> {
    const results: InsuranceVerification[] = [];
    for (const patientId of patientIds) {
      try {
        const verification = await this.create(
          tenantId,
          { patientId, verificationType: VerificationType.BATCH },
          actorId,
          actorName,
          actorRole,
        );
        results.push(verification);
      } catch {
        // Skip patients that fail (e.g., no insurance)
      }
    }
    return results;
  }

  private async runVerification(v: InsuranceVerification, tenantId: string, insurance: PatientInsurance | null, actorId: string, actorName: string): Promise<void> {
    const request: EligibilityRequest = {
      patientId: v.patientId,
      patientInsuranceId: v.patientInsuranceId,
      insurancePayerId: v.insurancePayerId || insurance?.insurancePayerId || null,
      policyNumber: v.policyNumber || insurance?.policyNumber || null,
      groupNumber: v.groupNumber || insurance?.groupNumber || null,
      subscriberName: insurance?.subscriberName || null,
      subscriberDob: insurance?.subscriberDob ? insurance.subscriberDob.toISOString().split('T')[0] : null,
      subscriberRelation: insurance?.subscriberRelation || null,
      serviceType: v.serviceType || '30',
      appointmentId: v.appointmentId,
    };

    v.status = VerificationStatus.PENDING;
    v.requestPayload = request as unknown as Record<string, unknown>;

    try {
      const response = await this.provider.verify(request);
      v.coverageStatus = response.coverageStatus as CoverageStatus;
      v.status = response.eligible ? VerificationStatus.ACTIVE : response.errorMessage ? VerificationStatus.FAILED : VerificationStatus.INACTIVE;
      v.effectiveDate = response.effectiveDate ? new Date(response.effectiveDate) : null;
      v.expirationDate = response.expirationDate ? new Date(response.expirationDate) : null;
      v.deductibleIndividual = response.deductibleIndividual ?? null;
      v.deductibleFamily = response.deductibleFamily ?? null;
      v.deductibleRemaining = response.deductibleRemaining ?? null;
      v.outOfPocketIndividual = response.outOfPocketIndividual ?? null;
      v.outOfPocketFamily = response.outOfPocketFamily ?? null;
      v.outOfPocketRemaining = response.outOfPocketRemaining ?? null;
      v.copayAmount = response.copayAmount ?? null;
      v.coinsurancePercentage = response.coinsurancePercentage ?? null;
      v.authorizationRequired = response.authorizationRequired ?? false;
      v.referralRequired = response.referralRequired ?? false;
      v.benefitLimitations = response.benefitLimitations ?? null;
      v.benefits = response.benefits ?? null;
      v.planName = response.planName || v.planName || null;
      v.planType = response.planType || v.planType || null;
      v.network = response.network || v.network || null;
      v.subscriberName = response.subscriberName || insurance?.subscriberName || v.subscriberName || null;
      v.subscriberRelation = response.subscriberRelation || insurance?.subscriberRelation || v.subscriberRelation || null;
      v.payerName = response.payerName || v.payerName || insurance?.payer?.name || null;
      v.responsePayload = response.rawResponse || null;
      v.errorDetails = response.errorCode || response.errorMessage
        ? { errorCode: response.errorCode, errorMessage: response.errorMessage }
        : null;
      v.verifiedAt = new Date();
      v.verifiedBy = actorId;
      v.verifiedByName = actorName;
    } catch (err) {
      v.status = VerificationStatus.ERROR;
      v.coverageStatus = CoverageStatus.UNKNOWN;
      v.errorDetails = { errorCode: 'PROVIDER-ERROR', errorMessage: (err as Error).message };
      v.verifiedAt = new Date();
      v.verifiedBy = actorId;
      v.verifiedByName = actorName;
    }

    await this.verificationRepo.save(v);
  }
}
