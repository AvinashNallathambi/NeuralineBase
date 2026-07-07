import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Encounter, EncounterStatus, EncounterType } from './entities/encounter.entity';
import { CreateEncounterDto } from './dto/create-encounter.dto';
import { UpdateEncounterDto } from './dto/update-encounter.dto';
import { ClinicalTemplate } from './entities/clinical-template.entity';

export interface PaginationOptions {
  page: number;
  limit: number;
  search?: string;
  status?: EncounterStatus;
  type?: string;
  patientId?: string;
  providerId?: string;
  startDateFrom?: string;
  startDateTo?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class EncounterService {
  private readonly logger = new Logger(EncounterService.name);

  constructor(
    @InjectRepository(Encounter)
    private readonly encounterRepository: Repository<Encounter>,
    @InjectRepository(ClinicalTemplate)
    private readonly clinicalTemplateRepository: Repository<ClinicalTemplate>,
  ) {}

  async create(tenantId: string, createEncounterDto: CreateEncounterDto): Promise<Encounter> {
    const encounter = new Encounter();
    encounter.tenantId = tenantId;
    encounter.patientId = createEncounterDto.patientId;
    encounter.providerId = createEncounterDto.providerId;
    encounter.appointmentId = createEncounterDto.appointmentId || null;
    encounter.departmentId = createEncounterDto.departmentId || null;
    encounter.location = createEncounterDto.location || null;
    encounter.room = createEncounterDto.room || null;
    encounter.type = createEncounterDto.type || EncounterType.OFFICE_VISIT;
    encounter.status = createEncounterDto.status || EncounterStatus.SCHEDULED;
    encounter.priority = createEncounterDto.priority || null;
    encounter.visitCategory = createEncounterDto.visitCategory || null;
    encounter.visitReason = createEncounterDto.visitReason || null;
    encounter.chiefComplaint = createEncounterDto.chiefComplaint || null;
    encounter.clinicalTemplateId = createEncounterDto.clinicalTemplateId || null;
    encounter.arrivalTime = createEncounterDto.arrivalTime ? new Date(createEncounterDto.arrivalTime) : null;
    encounter.startTime = new Date(createEncounterDto.startTime);
    encounter.endTime = createEncounterDto.endTime ? new Date(createEncounterDto.endTime) : null;
    encounter.durationMinutes = createEncounterDto.durationMinutes ?? null;
    encounter.soapNote = createEncounterDto.soapNote || {};
    encounter.vitals = createEncounterDto.vitals || {};
    encounter.diagnoses = (createEncounterDto.diagnoses || []).map((d) => ({
      code: d.code,
      description: d.description,
      isPrimary: d.isPrimary ?? false,
      type: d.type as 'chronic' | 'acute' | 'rule_out' | undefined,
      status: (d.status as 'active' | 'resolved' | 'ruled_out' | undefined) || 'active',
      onsetDate: d.onsetDate,
      resolvedDate: d.resolvedDate,
      notes: d.notes,
    }));
    encounter.treatmentPlan = createEncounterDto.treatmentPlan || {};
    encounter.allergies = (createEncounterDto.allergies || []).map((a) => ({
      allergen: a.allergen,
      reaction: a.reaction,
      severity: a.severity as 'mild' | 'moderate' | 'severe' | 'life_threatening',
      type: a.type as 'drug' | 'food' | 'environmental' | 'other' | undefined,
      onsetDate: a.onsetDate,
      notes: a.notes,
    }));
    encounter.orders = (createEncounterDto.orders || {}) as typeof encounter.orders;
    encounter.attachments = (createEncounterDto.attachments || []) as typeof encounter.attachments;
    encounter.clinicalNotes = createEncounterDto.clinicalNotes || null;
    encounter.notes = createEncounterDto.notes || null;
    encounter.isLocked = false;
    encounter.auditTrail = [
      {
        action: 'created',
        performedBy: createEncounterDto.providerId,
        performedAt: new Date().toISOString(),
        note: 'Encounter created',
      },
    ];

    const saved = await this.encounterRepository.save(encounter);

    if (saved.clinicalTemplateId) {
      const template = await this.clinicalTemplateRepository.findOne({
        where: { id: saved.clinicalTemplateId, tenantId },
      });
      if (template) {
        template.usageCount += 1;
        template.lastUsedAt = new Date();
        await this.clinicalTemplateRepository.save(template);
      }
    }

    return saved;
  }

  async findAll(
    tenantId: string,
    options: PaginationOptions,
  ): Promise<PaginatedResult<Encounter>> {
    const { page, limit, search, status, type, patientId, providerId, startDateFrom, startDateTo } = options;
    const skip = (page - 1) * limit;

    const queryBuilder = this.encounterRepository
      .createQueryBuilder('encounter')
      .where('encounter.tenantId = :tenantId', { tenantId });

    if (search) {
      queryBuilder.andWhere(
        '(encounter.chiefComplaint ILIKE :search OR encounter.visitReason ILIKE :search OR encounter.notes ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (status) {
      queryBuilder.andWhere('encounter.status = :status', { status });
    }

    if (type) {
      queryBuilder.andWhere('encounter.type = :type', { type });
    }

    if (patientId) {
      queryBuilder.andWhere('encounter.patientId = :patientId', { patientId });
    }

    if (providerId) {
      queryBuilder.andWhere('encounter.providerId = :providerId', { providerId });
    }

    if (startDateFrom) {
      queryBuilder.andWhere('encounter.startTime >= :startDateFrom', {
        startDateFrom: new Date(startDateFrom),
      });
    }

    if (startDateTo) {
      queryBuilder.andWhere('encounter.startTime <= :startDateTo', {
        startDateTo: new Date(startDateTo),
      });
    }

    queryBuilder.orderBy('encounter.startTime', 'DESC').skip(skip).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string, tenantId?: string): Promise<Encounter> {
    const where: Record<string, unknown> = { id };
    if (tenantId) {
      where['tenantId'] = tenantId;
    }

    const encounter = await this.encounterRepository.findOne({ where });

    if (!encounter) {
      throw new NotFoundException(`Encounter with ID ${id} not found`);
    }

    return encounter;
  }

  async update(id: string, updateEncounterDto: UpdateEncounterDto, tenantId?: string): Promise<Encounter> {
    const encounter = await this.findOne(id, tenantId);

    if (encounter.isLocked) {
      throw new ForbiddenException('Encounter is locked and cannot be modified. Reopen the encounter first.');
    }

    const fieldsToSkip = new Set(['startTime', 'endTime', 'arrivalTime', 'durationMinutes', 'diagnoses', 'allergies', 'vitals', 'treatmentPlan', 'orders', 'attachments', 'soapNote']);

    for (const [key, value] of Object.entries(updateEncounterDto)) {
      if (value !== undefined && !fieldsToSkip.has(key)) {
        (encounter as unknown as Record<string, unknown>)[key] = value;
      }
    }

    if (updateEncounterDto.startTime) {
      encounter.startTime = new Date(updateEncounterDto.startTime);
    }
    if (updateEncounterDto.endTime) {
      encounter.endTime = new Date(updateEncounterDto.endTime);
    }
    if (updateEncounterDto.arrivalTime) {
      encounter.arrivalTime = new Date(updateEncounterDto.arrivalTime);
    }
    if (updateEncounterDto.durationMinutes !== undefined) {
      encounter.durationMinutes = updateEncounterDto.durationMinutes;
    }
    if (updateEncounterDto.soapNote !== undefined) {
      encounter.soapNote = { ...encounter.soapNote, ...updateEncounterDto.soapNote };
    }
    if (updateEncounterDto.vitals !== undefined) {
      encounter.vitals = { ...encounter.vitals, ...updateEncounterDto.vitals };
    }
    if (updateEncounterDto.diagnoses !== undefined) {
      encounter.diagnoses = updateEncounterDto.diagnoses.map((d) => ({
        code: d.code,
        description: d.description,
        isPrimary: d.isPrimary ?? false,
        type: d.type as 'chronic' | 'acute' | 'rule_out' | undefined,
        status: (d.status as 'active' | 'resolved' | 'ruled_out' | undefined) || 'active',
        onsetDate: d.onsetDate,
        resolvedDate: d.resolvedDate,
        notes: d.notes,
      }));
    }
    if (updateEncounterDto.allergies !== undefined) {
      encounter.allergies = updateEncounterDto.allergies.map((a) => ({
        allergen: a.allergen,
        reaction: a.reaction,
        severity: a.severity as 'mild' | 'moderate' | 'severe' | 'life_threatening',
        type: a.type as 'drug' | 'food' | 'environmental' | 'other' | undefined,
        onsetDate: a.onsetDate,
        notes: a.notes,
      }));
    }
    if (updateEncounterDto.treatmentPlan !== undefined) {
      encounter.treatmentPlan = { ...encounter.treatmentPlan, ...updateEncounterDto.treatmentPlan };
    }
    if (updateEncounterDto.orders !== undefined) {
      encounter.orders = { ...encounter.orders, ...updateEncounterDto.orders } as typeof encounter.orders;
    }
    if (updateEncounterDto.attachments !== undefined) {
      encounter.attachments = updateEncounterDto.attachments as typeof encounter.attachments;
    }

    encounter.auditTrail = [
      ...(encounter.auditTrail || []),
      {
        action: 'updated',
        performedBy: 'system',
        performedAt: new Date().toISOString(),
      },
    ];

    return this.encounterRepository.save(encounter);
  }

  async remove(id: string, tenantId?: string): Promise<void> {
    const encounter = await this.findOne(id, tenantId);
    await this.encounterRepository.softRemove(encounter);
  }

  async findByPatient(patientId: string, tenantId?: string): Promise<Encounter[]> {
    const where: Record<string, unknown> = { patientId };
    if (tenantId) {
      where['tenantId'] = tenantId;
    }
    return this.encounterRepository.find({
      where,
      order: { startTime: 'DESC' },
    });
  }

  async transitionStatus(id: string, status: EncounterStatus, performedBy?: string, tenantId?: string): Promise<Encounter> {
    const encounter = await this.findOne(id, tenantId);

    if (encounter.isLocked) {
      throw new ForbiddenException('Encounter is locked. Reopen it before changing status.');
    }

    const validTransitions: Record<EncounterStatus, EncounterStatus[]> = {
      [EncounterStatus.SCHEDULED]: [EncounterStatus.IN_PROGRESS, EncounterStatus.CANCELLED, EncounterStatus.NO_SHOW],
      [EncounterStatus.IN_PROGRESS]: [EncounterStatus.COMPLETED, EncounterStatus.CANCELLED],
      [EncounterStatus.COMPLETED]: [EncounterStatus.IN_PROGRESS],
      [EncounterStatus.CANCELLED]: [],
      [EncounterStatus.NO_SHOW]: [],
    };

    const allowedTransitions = validTransitions[encounter.status];
    if (!allowedTransitions.includes(status)) {
      throw new BadRequestException(
        `Cannot transition from ${encounter.status} to ${status}. Valid transitions: ${allowedTransitions.join(', ') || 'none'}`,
      );
    }

    const previousStatus = encounter.status;
    encounter.status = status;

    if (status === EncounterStatus.IN_PROGRESS && !encounter.endTime) {
      encounter.endTime = null;
    }

    if (status === EncounterStatus.COMPLETED) {
      if (!encounter.endTime) {
        encounter.endTime = new Date();
      }
      const diffMs = encounter.endTime.getTime() - encounter.startTime.getTime();
      encounter.durationMinutes = Math.round(diffMs / 60000);
    }

    encounter.auditTrail = [
      ...(encounter.auditTrail || []),
      {
        action: 'status_changed',
        performedBy: performedBy || 'system',
        performedAt: new Date().toISOString(),
        previousStatus,
        newStatus: status,
      },
    ];

    return this.encounterRepository.save(encounter);
  }

  async sign(id: string, userId: string, tenantId?: string): Promise<Encounter> {
    const encounter = await this.findOne(id, tenantId);

    if (encounter.status !== EncounterStatus.COMPLETED) {
      throw new BadRequestException('Only completed encounters can be signed.');
    }

    if (encounter.signedAt) {
      throw new BadRequestException('Encounter has already been signed.');
    }

    encounter.signedAt = new Date();
    encounter.signedBy = userId;
    encounter.auditTrail = [
      ...(encounter.auditTrail || []),
      {
        action: 'signed',
        performedBy: userId,
        performedAt: new Date().toISOString(),
        note: 'Encounter signed by provider',
      },
    ];

    return this.encounterRepository.save(encounter);
  }

  async lock(id: string, userId: string, tenantId?: string): Promise<Encounter> {
    const encounter = await this.findOne(id, tenantId);

    if (!encounter.signedAt) {
      throw new BadRequestException('Encounter must be signed before it can be locked.');
    }

    if (encounter.isLocked) {
      throw new BadRequestException('Encounter is already locked.');
    }

    encounter.isLocked = true;
    encounter.lockedAt = new Date();
    encounter.lockedBy = userId;
    encounter.auditTrail = [
      ...(encounter.auditTrail || []),
      {
        action: 'locked',
        performedBy: userId,
        performedAt: new Date().toISOString(),
        note: 'Encounter locked',
      },
    ];

    return this.encounterRepository.save(encounter);
  }

  async reopen(id: string, userId: string, reason: string, tenantId?: string): Promise<Encounter> {
    const encounter = await this.findOne(id, tenantId);

    if (!encounter.isLocked) {
      throw new BadRequestException('Encounter is not locked.');
    }

    encounter.isLocked = false;
    encounter.lockedAt = null;
    encounter.lockedBy = null;
    encounter.auditTrail = [
      ...(encounter.auditTrail || []),
      {
        action: 'reopened',
        performedBy: userId,
        performedAt: new Date().toISOString(),
        note: reason || 'Encounter reopened for amendment',
      },
    ];

    return this.encounterRepository.save(encounter);
  }
}
