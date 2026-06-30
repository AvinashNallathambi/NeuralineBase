import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { Prescription } from './entities/prescription.entity';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';

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

@Injectable()
export class PrescriptionsService {
  private readonly logger = new Logger(PrescriptionsService.name);

  constructor(
    @InjectRepository(Prescription)
    private readonly prescriptionRepository: Repository<Prescription>,
  ) {}

  /**
   * Find all prescriptions with pagination, search, and filters
   */
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

  /**
   * Find a single prescription by ID within a tenant
   */
  async findOne(tenantId: string, id: string): Promise<Prescription> {
    const prescription = await this.prescriptionRepository.findOne({
      where: { id, tenantId },
    });

    if (!prescription) {
      throw new NotFoundException(`Prescription with ID "${id}" not found`);
    }

    return prescription;
  }

  /**
   * Create a new prescription
   */
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

  /**
   * Update a prescription
   */
  async update(
    tenantId: string,
    id: string,
    dto: Partial<CreatePrescriptionDto>,
  ): Promise<Prescription> {
    const prescription = await this.findOne(tenantId, id);

    if (dto.prescribedDate) {
      (dto as any).prescribedDate = new Date(dto.prescribedDate);
    }

    Object.assign(prescription, dto);
    const updated = await this.prescriptionRepository.save(prescription);
    this.logger.log(`Prescription updated: ${id} in tenant ${tenantId}`);
    return updated;
  }

  /**
   * Soft delete a prescription
   */
  async softDelete(tenantId: string, id: string): Promise<void> {
    const prescription = await this.findOne(tenantId, id);
    await this.prescriptionRepository.softRemove(prescription);
    this.logger.log(`Prescription soft deleted: ${id} in tenant ${tenantId}`);
  }
}
