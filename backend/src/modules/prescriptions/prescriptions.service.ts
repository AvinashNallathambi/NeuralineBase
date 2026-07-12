import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Prescription } from './entities/prescription.entity';
import { PrescriptionRefill } from './entities/prescription-refill.entity';
import { PrescriptionStatusHistory } from './entities/prescription-status-history.entity';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { CreateRefillDto } from './dto/create-refill.dto';
import { UpdateRefillDto } from './dto/update-refill.dto';
import { UpdatePrescriptionStatusDto } from './dto/update-status.dto';

export interface PaginationOptions {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  patientId?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['active', 'cancelled'],
  active: ['sent', 'completed', 'discontinued', 'cancelled'],
  sent: ['completed', 'discontinued'],
  completed: [],
  cancelled: [],
  discontinued: [],
  expired: [],
};

const EDITABLE_STATUSES = ['draft', 'active'];
const FULLY_EDITABLE_STATUSES = ['draft'];

@Injectable()
export class PrescriptionsService {
  private readonly logger = new Logger(PrescriptionsService.name);

  constructor(
    @InjectRepository(Prescription)
    private readonly prescriptionRepository: Repository<Prescription>,
    @InjectRepository(PrescriptionRefill)
    private readonly refillRepository: Repository<PrescriptionRefill>,
    @InjectRepository(PrescriptionStatusHistory)
    private readonly statusHistoryRepository: Repository<PrescriptionStatusHistory>,
  ) {}

  async findAll(
    tenantId: string,
    options: PaginationOptions,
  ): Promise<PaginatedResult<Prescription>> {
    const { page, limit, search, status, patientId } = options;
    const skip = (page - 1) * limit;

    const queryBuilder = this.prescriptionRepository
      .createQueryBuilder('prescription')
      .where('prescription.tenantId = :tenantId', { tenantId });

    if (search) {
      queryBuilder.andWhere(
        '(prescription.patientName ILIKE :search OR prescription.pharmacy ILIKE :search OR prescription.medications::text ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (status) {
      queryBuilder.andWhere('prescription.status = :status', { status });
    }

    if (patientId) {
      queryBuilder.andWhere('prescription.patientId = :patientId', { patientId });
    }

    queryBuilder
      .orderBy('prescription.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(tenantId: string, id: string): Promise<Prescription> {
    const prescription = await this.prescriptionRepository.findOne({
      where: { id, tenantId },
    });

    if (!prescription) {
      throw new NotFoundException(`Prescription with ID "${id}" not found`);
    }

    return prescription;
  }

  async create(
    tenantId: string,
    dto: CreatePrescriptionDto,
  ): Promise<Prescription> {
    const prescribedDate = dto.prescribedDate
      ? new Date(dto.prescribedDate)
      : new Date();

    const prescription = this.prescriptionRepository.create({
      ...dto,
      tenantId,
      prescribedDate,
      status: dto.status || 'draft',
    });

    const saved = await this.prescriptionRepository.save(prescription);
    this.logger.log(`Prescription created: ${saved.id} in tenant ${tenantId}`);
    return saved;
  }

  async update(
    tenantId: string,
    id: string,
    dto: Partial<CreatePrescriptionDto>,
  ): Promise<Prescription> {
    const prescription = await this.findOne(tenantId, id);

    if (!EDITABLE_STATUSES.includes(prescription.status)) {
      throw new BadRequestException(
        `Prescription in status "${prescription.status}" cannot be edited`,
      );
    }

    if (!FULLY_EDITABLE_STATUSES.includes(prescription.status)) {
      const allowedFields = [
        'pharmacy',
        'notes',
        'medications',
      ];
      const attemptedFields = Object.keys(dto).filter(
        (k) => !allowedFields.includes(k) && k !== 'status',
      );
      if (attemptedFields.length > 0) {
        throw new BadRequestException(
          `Only ${allowedFields.join(', ')} can be edited for active prescriptions`,
        );
      }
    }

    if (dto.status && dto.status !== prescription.status) {
      return this.updateStatus(tenantId, id, { status: dto.status });
    }

    if (dto.prescribedDate) {
      (dto as any).prescribedDate = new Date(dto.prescribedDate);
    }

    const { status: _ignored, ...updateData } = dto;
    Object.assign(prescription, updateData);
    const updated = await this.prescriptionRepository.save(prescription);
    this.logger.log(`Prescription updated: ${id} in tenant ${tenantId}`);
    return updated;
  }

  async updateStatus(
    tenantId: string,
    id: string,
    dto: UpdatePrescriptionStatusDto,
    changedBy?: string,
  ): Promise<Prescription> {
    const prescription = await this.findOne(tenantId, id);
    const currentStatus = prescription.status;
    const newStatus = dto.status;

    if (currentStatus === newStatus) {
      return prescription;
    }

    const allowed = VALID_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Invalid status transition from "${currentStatus}" to "${newStatus}"`,
      );
    }

    const previousStatus = prescription.status;
    prescription.status = newStatus;

    if (newStatus === 'active' && !prescription.prescribedDate) {
      prescription.prescribedDate = new Date();
    }

    const updated = await this.prescriptionRepository.save(prescription);

    const history = this.statusHistoryRepository.create({
      tenantId,
      prescriptionId: prescription.id,
      previousStatus,
      newStatus,
      changedBy: changedBy || null,
      reason: dto.reason || null,
    });
    await this.statusHistoryRepository.save(history);

    this.logger.log(
      `Prescription status changed: ${id} ${previousStatus} -> ${newStatus} in tenant ${tenantId}`,
    );
    return updated;
  }

  async getStatusHistory(
    tenantId: string,
    id: string,
  ): Promise<PrescriptionStatusHistory[]> {
    await this.findOne(tenantId, id);
    return this.statusHistoryRepository.find({
      where: { tenantId, prescriptionId: id },
      order: { createdAt: 'DESC' },
    });
  }

  async softDelete(tenantId: string, id: string): Promise<void> {
    const prescription = await this.findOne(tenantId, id);
    await this.prescriptionRepository.softRemove(prescription);
    this.logger.log(`Prescription soft deleted: ${id} in tenant ${tenantId}`);
  }

  async createRefill(
    tenantId: string,
    prescriptionId: string,
    dto: CreateRefillDto,
    requestedBy?: string,
  ): Promise<PrescriptionRefill> {
    const prescription = await this.findOne(tenantId, prescriptionId);

    if (prescription.status !== 'active' && prescription.status !== 'sent') {
      throw new BadRequestException(
        `Refills can only be requested for active or sent prescriptions (current: ${prescription.status})`,
      );
    }

    const firstMed = prescription.medications[0];
    const refill = this.refillRepository.create({
      tenantId,
      prescriptionId: prescription.id,
      patientName: prescription.patientName,
      medication: firstMed?.medication || 'Unknown',
      dosage: firstMed?.dosage || '',
      status: 'pending',
      requestedBy: requestedBy || null,
      notes: dto.notes || null,
    });

    const saved = await this.refillRepository.save(refill);
    this.logger.log(
      `Refill request created: ${saved.id} for prescription ${prescriptionId}`,
    );
    return saved;
  }

  async findRefills(
    tenantId: string,
    prescriptionId?: string,
  ): Promise<PrescriptionRefill[]> {
    const where: any = { tenantId };
    if (prescriptionId) {
      where.prescriptionId = prescriptionId;
    }
    return this.refillRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async findRefillOne(
    tenantId: string,
    refillId: string,
  ): Promise<PrescriptionRefill> {
    const refill = await this.refillRepository.findOne({
      where: { id: refillId, tenantId },
    });
    if (!refill) {
      throw new NotFoundException(`Refill request with ID "${refillId}" not found`);
    }
    return refill;
  }

  async updateRefill(
    tenantId: string,
    refillId: string,
    dto: UpdateRefillDto,
    reviewedBy?: string,
  ): Promise<PrescriptionRefill> {
    const refill = await this.findRefillOne(tenantId, refillId);

    const validRefillTransitions: Record<string, string[]> = {
      pending: ['approved', 'denied', 'completed'],
      approved: ['completed'],
      denied: [],
      completed: [],
    };

    const allowed = validRefillTransitions[refill.status] || [];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Invalid refill status transition from "${refill.status}" to "${dto.status}"`,
      );
    }

    refill.status = dto.status;
    if (dto.notes !== undefined) {
      refill.notes = dto.notes;
    }
    if (dto.status === 'approved' || dto.status === 'denied' || dto.status === 'completed') {
      refill.reviewedBy = reviewedBy || null;
      refill.reviewedAt = new Date();
    }

    const updated = await this.refillRepository.save(refill);
    this.logger.log(
      `Refill ${refillId} status changed to ${dto.status} in tenant ${tenantId}`,
    );
    return updated;
  }

  async deleteRefill(tenantId: string, refillId: string): Promise<void> {
    const refill = await this.findRefillOne(tenantId, refillId);
    await this.refillRepository.softRemove(refill);
    this.logger.log(`Refill ${refillId} deleted in tenant ${tenantId}`);
  }
}
