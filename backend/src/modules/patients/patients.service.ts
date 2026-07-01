import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, FindOptionsWhere } from 'typeorm';
import { Patient } from './entities/patient.entity';
import { CreatePatientDto } from './dto/create-patient.dto';

export interface PaginationOptions {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  gender?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class PatientsService {
  private readonly logger = new Logger(PatientsService.name);

  constructor(
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
  ) {}

  /**
   * Find all patients with pagination, search, and filters
   */
  async findAll(
    tenantId: string,
    options: PaginationOptions,
  ): Promise<PaginatedResult<Patient>> {
    const { page, limit, search, status, gender } = options;
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<Patient> = { tenantId };

    if (status) {
      where.status = status;
    }
    if (gender) {
      where.gender = gender;
    }

    const queryBuilder = this.patientRepository
      .createQueryBuilder('patient')
      .where('patient.tenantId = :tenantId', { tenantId });

    if (search) {
      queryBuilder.andWhere(
        '(patient.firstName ILIKE :search OR patient.lastName ILIKE :search OR patient.mrn ILIKE :search OR patient.email ILIKE :search OR patient.phone ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (status) {
      queryBuilder.andWhere('patient.status = :status', { status });
    }

    if (gender) {
      queryBuilder.andWhere('patient.gender = :gender', { gender });
    }

    queryBuilder
      .orderBy('patient.createdAt', 'DESC')
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
   * Find a single patient by ID within a tenant
   */
  async findOne(tenantId: string, id: string): Promise<Patient> {
    const patient = await this.patientRepository.findOne({
      where: { id, tenantId },
    });

    if (!patient) {
      throw new NotFoundException(`Patient with ID "${id}" not found`);
    }

    return patient;
  }

  /**
   * Create a new patient
   */
  async create(
    tenantId: string,
    dto: CreatePatientDto,
  ): Promise<Patient> {
    // Check for duplicate MRN within tenant
    if (dto.mrn) {
      const existing = await this.patientRepository.findOne({
        where: { tenantId, mrn: dto.mrn },
      });
      if (existing) {
        throw new ConflictException(
          `Patient with MRN "${dto.mrn}" already exists`,
        );
      }
    }

    const patient = this.patientRepository.create({
      ...dto,
      tenantId,
      status: dto.status || 'active',
    });

    const saved = await this.patientRepository.save(patient);
    this.logger.log(`Patient created: ${saved.id} in tenant ${tenantId}`);
    return saved;
  }

  /**
   * Update a patient
   */
  async update(
    tenantId: string,
    id: string,
    dto: Partial<CreatePatientDto>,
  ): Promise<Patient> {
    const patient = await this.findOne(tenantId, id);

    // Check MRN uniqueness if being updated
    if (dto.mrn && dto.mrn !== patient.mrn) {
      const existing = await this.patientRepository.findOne({
        where: { tenantId, mrn: dto.mrn },
      });
      if (existing) {
        throw new ConflictException(
          `Patient with MRN "${dto.mrn}" already exists`,
        );
      }
    }

    Object.assign(patient, dto);
    const updated = await this.patientRepository.save(patient);
    this.logger.log(`Patient updated: ${id} in tenant ${tenantId}`);
    return updated;
  }

  /**
   * Soft delete a patient
   */
  async softDelete(tenantId: string, id: string): Promise<void> {
    const patient = await this.findOne(tenantId, id);
    await this.patientRepository.softRemove(patient);
    this.logger.log(`Patient soft deleted: ${id} in tenant ${tenantId}`);
  }

  /**
   * Get encounters for a patient
   */
  async getEncounters(tenantId: string, patientId: string): Promise<unknown[]> {
    // Verify patient exists
    await this.findOne(tenantId, patientId);

    // TODO: Query encounters repository
    // return this.encounterRepository.find({ where: { tenantId, patientId } });
    return [];
  }

  /**
   * Get prescriptions for a patient
   */
  async getPrescriptions(
    tenantId: string,
    patientId: string,
  ): Promise<unknown[]> {
    // Verify patient exists
    await this.findOne(tenantId, patientId);

    // TODO: Query prescriptions repository
    // return this.prescriptionRepository.find({ where: { tenantId, patientId } });
    return [];
  }

  /**
   * Upload a document for a patient
   */
  async uploadDocument(
    tenantId: string,
    patientId: string,
    file: Express.Multer.File,
    documentType: string,
    description: string,
  ): Promise<{ id: string; fileName: string; documentType: string; url: string }> {
    // Verify patient exists
    await this.findOne(tenantId, patientId);

    // TODO: Save file to storage (S3 or local)
    // TODO: Create document record in database
    const documentId = 'placeholder-id';
    const fileUrl = `/uploads/${tenantId}/${patientId}/${file.originalname}`;

    this.logger.log(
      `Document uploaded for patient ${patientId}: ${file.originalname} (${documentType})`,
    );

    return {
      id: documentId,
      fileName: file.originalname,
      documentType,
      url: fileUrl,
    };
  }
}
