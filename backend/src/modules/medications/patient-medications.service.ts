import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PatientMedication } from './entities/patient-medication.entity';
import { CreatePatientMedicationDto } from './dto/create-patient-medication.dto';

export interface PaginationOptions {
  page: number;
  limit: number;
  patientId?: string;
  status?: string;
  source?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class PatientMedicationsService {
  private readonly logger = new Logger(PatientMedicationsService.name);

  constructor(
    @InjectRepository(PatientMedication)
    private readonly repository: Repository<PatientMedication>,
  ) {}

  async findAll(
    tenantId: string,
    options: PaginationOptions,
  ): Promise<PaginatedResult<PatientMedication>> {
    const { page, limit, patientId, status, source } = options;
    const skip = (page - 1) * limit;

    const qb = this.repository
      .createQueryBuilder('med')
      .where('med.tenantId = :tenantId', { tenantId });

    if (patientId) qb.andWhere('med.patientId = :patientId', { patientId });
    if (status) qb.andWhere('med.status = :status', { status });
    if (source) qb.andWhere('med.source = :source', { source });

    qb.orderBy('med.createdAt', 'DESC').skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findByPatient(
    tenantId: string,
    patientId: string,
  ): Promise<PatientMedication[]> {
    return this.repository.find({
      where: { tenantId, patientId },
      order: { status: 'ASC', createdAt: 'DESC' },
    });
  }

  async findOne(tenantId: string, id: string): Promise<PatientMedication> {
    const med = await this.repository.findOne({ where: { id, tenantId } });
    if (!med) throw new NotFoundException(`Patient medication "${id}" not found`);
    return med;
  }

  async create(
    tenantId: string,
    dto: CreatePatientMedicationDto,
  ): Promise<PatientMedication> {
    const med = this.repository.create({
      ...dto,
      tenantId,
      source: (dto.source || 'patient_reported') as any,
      takingStatus: (dto.takingStatus || 'taking') as any,
      status: (dto.status || 'active') as any,
      startDate: dto.startDate ? new Date(dto.startDate) : null,
      stopDate: dto.stopDate ? new Date(dto.stopDate) : null,
    }) as PatientMedication;
    const saved = await this.repository.save(med);
    this.logger.log(`Patient medication created: ${saved.id}`);
    return saved;
  }

  async update(
    tenantId: string,
    id: string,
    dto: Partial<CreatePatientMedicationDto>,
  ): Promise<PatientMedication> {
    const med = await this.findOne(tenantId, id);
    const { startDate, stopDate, ...rest } = dto;
    Object.assign(med, rest);
    if (startDate !== undefined) med.startDate = startDate ? new Date(startDate) : null;
    if (stopDate !== undefined) med.stopDate = stopDate ? new Date(stopDate) : null;
    const updated = await this.repository.save(med);
    this.logger.log(`Patient medication updated: ${id}`);
    return updated;
  }

  async updateTakingStatus(
    tenantId: string,
    id: string,
    takingStatus: string,
    takingNotes?: string,
  ): Promise<PatientMedication> {
    const med = await this.findOne(tenantId, id);
    med.takingStatus = takingStatus as any;
    if (takingNotes !== undefined) med.takingNotes = takingNotes;
    if (takingStatus === 'not_taking' || takingStatus === 'completed') {
      med.status = takingStatus === 'completed' ? 'completed' : 'discontinued';
      med.stopDate = med.stopDate || new Date();
    }
    return this.repository.save(med);
  }

  async markReviewed(
    tenantId: string,
    id: string,
    reviewedBy: string,
  ): Promise<PatientMedication> {
    const med = await this.findOne(tenantId, id);
    med.isReviewed = true;
    med.reviewedAt = new Date();
    med.reviewedBy = reviewedBy;
    return this.repository.save(med);
  }

  async softDelete(tenantId: string, id: string): Promise<void> {
    const med = await this.findOne(tenantId, id);
    await this.repository.softRemove(med);
  }
}
