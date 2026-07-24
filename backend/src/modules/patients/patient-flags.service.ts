import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PatientFlag,
  PatientFlagAcknowledgement,
  PatientFlagSeverity,
  PatientFlagCategory,
  PatientFlagStatus,
} from './entities/patient-flag.entity';
import {
  CreatePatientFlagDto,
  UpdatePatientFlagDto,
  ResolvePatientFlagDto,
  AcknowledgePatientFlagDto,
  QueryPatientFlagDto,
} from './dto/patient-flag.dto';
import { PatientsService } from './patients.service';

export interface FlagListQuery {
  severity?: string;
  category?: string;
  status?: string;
  showAsBanner?: boolean;
}

@Injectable()
export class PatientFlagsService {
  private readonly logger = new Logger(PatientFlagsService.name);

  constructor(
    @InjectRepository(PatientFlag)
    private readonly flagRepository: Repository<PatientFlag>,
    @InjectRepository(PatientFlagAcknowledgement)
    private readonly ackRepository: Repository<PatientFlagAcknowledgement>,
    private readonly patientsService: PatientsService,
  ) {}

  /**
   * List flags for a patient (defaults to active only)
   */
  async list(
    tenantId: string,
    patientId: string,
    query: QueryPatientFlagDto,
  ): Promise<PatientFlag[]> {
    await this.patientsService.findOne(tenantId, patientId);

    const qb = this.flagRepository
      .createQueryBuilder('flag')
      .where('flag.tenantId = :tenantId', { tenantId })
      .andWhere('flag.patientId = :patientId', { patientId })
      .andWhere('flag.deletedAt IS NULL');

    if (query.severity) {
      qb.andWhere('flag.severity = :severity', { severity: query.severity });
    }
    if (query.category) {
      qb.andWhere('flag.category = :category', { category: query.category });
    }
    if (query.status) {
      qb.andWhere('flag.status = :status', { status: query.status });
    } else {
      qb.andWhere('flag.status = :status', { status: PatientFlagStatus.ACTIVE });
    }
    if (query.showAsBanner !== undefined) {
      qb.andWhere('flag.showAsBanner = :showAsBanner', { showAsBanner: query.showAsBanner });
    }

    // Critical first, then warning, then informational; newest first
    qb
      .addOrderBy(
        `CASE flag.severity
          WHEN '${PatientFlagSeverity.CRITICAL}' THEN 0
          WHEN '${PatientFlagSeverity.WARNING}' THEN 1
          WHEN '${PatientFlagSeverity.INFORMATIONAL}' THEN 2
          ELSE 3 END`,
        'ASC',
      )
      .addOrderBy('flag.createdAt', 'DESC');

    return qb.getMany();
  }

  /**
   * Get a single flag (with acknowledgement summary)
   */
  async findOne(tenantId: string, patientId: string, flagId: string): Promise<PatientFlag> {
    const flag = await this.flagRepository.findOne({
      where: { id: flagId, tenantId, patientId },
    });
    if (!flag) {
      throw new NotFoundException(`Flag with ID "${flagId}" not found`);
    }
    return flag;
  }

  async create(
    tenantId: string,
    patientId: string,
    dto: CreatePatientFlagDto,
    createdByUserId?: string,
  ): Promise<PatientFlag> {
    await this.patientsService.findOne(tenantId, patientId);

    // Critical flags default to showAsBanner=true
    const severity = dto.severity || PatientFlagSeverity.WARNING;
    const showAsBanner = dto.showAsBanner ?? (severity === PatientFlagSeverity.CRITICAL);

    const flag = new PatientFlag();
    flag.tenantId = tenantId;
    flag.patientId = patientId;
    flag.type = dto.type.trim();
    flag.category = dto.category || PatientFlagCategory.GENERAL;
    flag.severity = severity;
    flag.status = PatientFlagStatus.ACTIVE;
    flag.showAsBanner = showAsBanner;
    flag.note = dto.note || null;
    flag.createdByUserId = createdByUserId || null;

    const saved = await this.flagRepository.save(flag);
    this.logger.log(`Flag created for patient ${patientId}: ${saved.id} (${saved.type})`);
    return saved;
  }

  async update(
    tenantId: string,
    patientId: string,
    flagId: string,
    dto: UpdatePatientFlagDto,
  ): Promise<PatientFlag> {
    const flag = await this.findOne(tenantId, patientId, flagId);

    if (dto.severity !== undefined) flag.severity = dto.severity;
    if (dto.category !== undefined) flag.category = dto.category;
    if (dto.showAsBanner !== undefined) flag.showAsBanner = dto.showAsBanner;
    if (dto.note !== undefined) flag.note = dto.note || null;

    const saved = await this.flagRepository.save(flag);
    this.logger.log(`Flag updated for patient ${patientId}: ${flagId}`);
    return saved;
  }

  async resolve(
    tenantId: string,
    patientId: string,
    flagId: string,
    dto: ResolvePatientFlagDto,
    resolvedByUserId?: string,
  ): Promise<PatientFlag> {
    const flag = await this.findOne(tenantId, patientId, flagId);

    if (flag.status === PatientFlagStatus.RESOLVED) {
      throw new BadRequestException('Flag is already resolved');
    }

    if (flag.severity === PatientFlagSeverity.CRITICAL && !dto.resolutionReason) {
      throw new BadRequestException('Resolution reason is required for critical flags');
    }

    flag.status = PatientFlagStatus.RESOLVED;
    flag.resolvedAt = new Date();
    flag.resolvedByUserId = resolvedByUserId || null;
    flag.resolutionReason = dto.resolutionReason || null;

    const saved = await this.flagRepository.save(flag);
    this.logger.log(`Flag resolved for patient ${patientId}: ${flagId}`);
    return saved;
  }

  async remove(tenantId: string, patientId: string, flagId: string): Promise<void> {
    const flag = await this.findOne(tenantId, patientId, flagId);
    await this.flagRepository.softRemove(flag);
    this.logger.log(`Flag soft deleted for patient ${patientId}: ${flagId}`);
  }

  /**
   * Acknowledge a critical flag for the current user (idempotent)
   */
  async acknowledge(
    tenantId: string,
    patientId: string,
    flagId: string,
    dto: AcknowledgePatientFlagDto,
    userId: string,
  ): Promise<{ acknowledged: true; at: Date }> {
    const flag = await this.findOne(tenantId, patientId, flagId);

    if (flag.status !== PatientFlagStatus.ACTIVE) {
      throw new BadRequestException('Cannot acknowledge a resolved flag');
    }

    const existing = await this.ackRepository.findOne({
      where: { tenantId, flagId, userId },
    });
    if (existing) {
      return { acknowledged: true, at: existing.acknowledgedAt };
    }

    const ack = new PatientFlagAcknowledgement();
    ack.tenantId = tenantId;
    ack.flagId = flagId;
    ack.userId = userId;
    ack.userEmail = dto.userEmail || null;

    const saved = await this.ackRepository.save(ack);
    this.logger.log(`Flag ${flagId} acknowledged by user ${userId}`);
    return { acknowledged: true, at: saved.acknowledgedAt };
  }

  /**
   * List acknowledgements for a flag (for audit / "who has seen this")
   */
  async listAcknowledgements(
    tenantId: string,
    patientId: string,
    flagId: string,
  ): Promise<PatientFlagAcknowledgement[]> {
    await this.findOne(tenantId, patientId, flagId);
    return this.ackRepository.find({
      where: { tenantId, flagId },
      order: { acknowledgedAt: 'DESC' },
    });
  }

  /**
   * Return active flags for a patient that the current user has NOT yet acknowledged.
   * Used by the frontend to decide whether to pop the critical-flag modal.
   */
  async listUnacknowledged(
    tenantId: string,
    patientId: string,
    userId: string,
  ): Promise<PatientFlag[]> {
    await this.patientsService.findOne(tenantId, patientId);

    const flags = await this.flagRepository
      .createQueryBuilder('flag')
      .where('flag.tenantId = :tenantId', { tenantId })
      .andWhere('flag.patientId = :patientId', { patientId })
      .andWhere('flag.deletedAt IS NULL')
      .andWhere('flag.status = :status', { status: PatientFlagStatus.ACTIVE })
      .andWhere('flag.severity = :severity', { severity: PatientFlagSeverity.CRITICAL })
      .getMany();

    if (flags.length === 0) return [];

    const flagIds = flags.map((f) => f.id);
    const acked = await this.ackRepository
      .createQueryBuilder('ack')
      .select(['ack.flagId'])
      .where('ack.tenantId = :tenantId', { tenantId })
      .andWhere('ack.userId = :userId', { userId })
      .andWhere('ack.flagId IN (:...flagIds)', { flagIds })
      .getMany();

    const ackedIds = new Set(acked.map((a) => a.flagId));
    return flags.filter((f) => !ackedIds.has(f.id));
  }

  /**
   * Compact summary for patient list tiles / banner: counts by severity
   */
  async getSummary(
    tenantId: string,
    patientId: string,
  ): Promise<{
    critical: number;
    warning: number;
    informational: number;
    banner: PatientFlag[];
  }> {
    const flags = await this.flagRepository
      .createQueryBuilder('flag')
      .where('flag.tenantId = :tenantId', { tenantId })
      .andWhere('flag.patientId = :patientId', { patientId })
      .andWhere('flag.deletedAt IS NULL')
      .andWhere('flag.status = :status', { status: PatientFlagStatus.ACTIVE })
      .getMany();

    return {
      critical: flags.filter((f) => f.severity === PatientFlagSeverity.CRITICAL).length,
      warning: flags.filter((f) => f.severity === PatientFlagSeverity.WARNING).length,
      informational: flags.filter((f) => f.severity === PatientFlagSeverity.INFORMATIONAL).length,
      banner: flags.filter((f) => f.showAsBanner),
    };
  }
}
