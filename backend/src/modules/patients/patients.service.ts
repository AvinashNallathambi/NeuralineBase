import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, FindOptionsWhere, Brackets } from 'typeorm';
import * as path from 'path';
import * as fs from 'fs/promises';
import { createReadStream } from 'fs';
import { ConfigService } from '@nestjs/config';
import { Patient } from './entities/patient.entity';
import { PatientProblem, ProblemClinicalStatus, ProblemVerificationStatus, DiagnosisCodingSystem } from './entities/patient-problem.entity';
import { PatientDocument, PatientDocumentType } from './entities/patient-document.entity';
import { CreatePatientDto } from './dto/create-patient.dto';
import { CreatePatientProblemDto } from './dto/create-patient-problem.dto';
import { UpdatePatientProblemDto } from './dto/update-patient-problem.dto';

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

export interface ProblemListQuery {
  clinicalStatus?: string;
  isChronic?: string;
  search?: string;
}

@Injectable()
export class PatientsService {
  private readonly logger = new Logger(PatientsService.name);

  constructor(
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
    @InjectRepository(PatientProblem)
    private readonly problemRepository: Repository<PatientProblem>,
    @InjectRepository(PatientDocument)
    private readonly documentRepository: Repository<PatientDocument>,
    private readonly configService: ConfigService,
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
      .take(limit)
      .loadRelationCountAndMap('patient.insuranceCount', 'patient.insurances');

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
      relations: ['insurances', 'insurances.payer'],
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

    // Auto-generate MRN if not provided (format: MRN-YYYY-NNNNN)
    if (!dto.mrn) {
      dto.mrn = await this.generateMrn(tenantId);
    }

    const patient = this.patientRepository.create({
      ...dto,
      tenantId,
      status: dto.status || 'active',
    });

    const saved = await this.patientRepository.save(patient);
    this.logger.log(`Patient created: ${saved.id} (MRN: ${saved.mrn}) in tenant ${tenantId}`);
    return saved;
  }

  /**
   * Generate a unique MRN for a patient within a tenant.
   * Format: MRN-YYYY-NNNNN (e.g., MRN-2026-00001)
   */
  private async generateMrn(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `MRN-${year}-`;

    // Find the highest existing MRN with this prefix for this tenant
    const patients = await this.patientRepository
      .createQueryBuilder('patient')
      .select('patient.mrn', 'mrn')
      .where('patient.tenantId = :tenantId', { tenantId })
      .andWhere('patient.mrn LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('patient.mrn', 'DESC')
      .limit(1)
      .getRawOne<{ mrn: string | null }>();

    let nextNum = 1;
    if (patients?.mrn) {
      const currentNum = parseInt(patients.mrn.replace(prefix, ''), 10);
      if (!isNaN(currentNum)) {
        nextNum = currentNum + 1;
      }
    }

    return `${prefix}${String(nextNum).padStart(5, '0')}`;
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
   * Upload a document for a patient.
   * Persists the file to disk under UPLOAD_DIR/{tenantId}/{patientId}/ and
   * records metadata in the patient_documents table.
   */
  async uploadDocument(
    tenantId: string,
    patientId: string,
    file: Express.Multer.File,
    documentType: string,
    description: string,
    uploadedByUserId?: string,
  ): Promise<{ id: string; fileName: string; documentType: string; url: string }> {
    // Verify patient exists
    await this.findOne(tenantId, patientId);

    const uploadDir = this.configService.get<string>('UPLOAD_DIR', 'uploads');
    const relDir = path.join(tenantId, patientId);
    const absDir = path.resolve(uploadDir, relDir);
    await fs.mkdir(absDir, { recursive: true });

    const ext = path.extname(file.originalname);
    const storedFileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;
    const absPath = path.join(absDir, storedFileName);
    // Multer memoryStorage keeps the file in `file.buffer`; diskStorage writes to `file.path`.
    if (file.buffer) {
      await fs.writeFile(absPath, file.buffer);
    } else if (file.path) {
      await fs.copyFile(file.path, absPath);
    } else {
      throw new Error('Uploaded file has no buffer or path');
    }

    const storagePath = path.join(relDir, storedFileName);
    const doc = this.documentRepository.create({
      tenantId,
      patientId,
      fileName: file.originalname,
      storedFileName,
      mimeType: file.mimetype,
      fileSize: file.size,
      documentType: (documentType as PatientDocumentType) || PatientDocumentType.OTHER,
      description: description || null,
      uploadedByUserId: uploadedByUserId || null,
      storagePath,
    });
    const saved = await this.documentRepository.save(doc);

    this.logger.log(
      `Document uploaded for patient ${patientId}: ${file.originalname} (${documentType})`,
    );

    return {
      id: saved.id,
      fileName: saved.fileName,
      documentType: saved.documentType,
      url: `/patients/${patientId}/documents/${saved.id}/download`,
    };
  }

  /**
   * List all (non-deleted) documents for a patient.
   */
  async getDocuments(
    tenantId: string,
    patientId: string,
  ): Promise<PatientDocument[]> {
    await this.findOne(tenantId, patientId);
    return this.documentRepository.find({
      where: { tenantId, patientId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Resolve a document record (tenant-scoped) for download.
   */
  async getDocumentForDownload(
    tenantId: string,
    patientId: string,
    documentId: string,
  ): Promise<{ document: PatientDocument; absPath: string }> {
    await this.findOne(tenantId, patientId);
    const doc = await this.documentRepository.findOne({
      where: { id: documentId, tenantId, patientId },
    });
    if (!doc) {
      throw new NotFoundException(`Document with ID "${documentId}" not found`);
    }
    const uploadDir = this.configService.get<string>('UPLOAD_DIR', 'uploads');
    const absPath = path.resolve(uploadDir, doc.storagePath);
    return { document: doc, absPath };
  }

  /**
   * Soft-delete a document record and remove the underlying file from disk.
   */
  async deleteDocument(
    tenantId: string,
    patientId: string,
    documentId: string,
  ): Promise<void> {
    const { document, absPath } = await this.getDocumentForDownload(
      tenantId,
      patientId,
      documentId,
    );
    await this.documentRepository.softRemove(document);
    try {
      await fs.unlink(absPath);
    } catch (err) {
      // File may already be gone — log but don't fail the request
      this.logger.warn(`Failed to remove file ${absPath}: ${(err as Error).message}`);
    }
    this.logger.log(`Document ${documentId} deleted for patient ${patientId}`);
  }

  async findProblems(
    tenantId: string,
    patientId: string,
    query: ProblemListQuery,
  ): Promise<PatientProblem[]> {
    await this.findOne(tenantId, patientId);

    const qb = this.problemRepository
      .createQueryBuilder('problem')
      .where('problem.tenantId = :tenantId', { tenantId })
      .andWhere('problem.patientId = :patientId', { patientId })
      .andWhere('problem.deletedAt IS NULL');

    if (query.clinicalStatus) {
      qb.andWhere('problem.clinicalStatus = :clinicalStatus', { clinicalStatus: query.clinicalStatus });
    }

    if (query.isChronic !== undefined) {
      qb.andWhere('problem.isChronic = :isChronic', { isChronic: query.isChronic === 'true' });
    }

    if (query.search) {
      const search = `%${query.search}%`;
      qb.andWhere(
        new Brackets((sub) => {
          sub.where('problem.code ILIKE :search', { search });
          sub.orWhere('problem.description ILIKE :search', { search });
        }),
      );
    }

    qb.orderBy('problem.isChronic', 'DESC').addOrderBy('problem.clinicalStatus', 'ASC').addOrderBy('problem.createdAt', 'DESC');

    return qb.getMany();
  }

  async findProblemById(tenantId: string, patientId: string, id: string): Promise<PatientProblem> {
    const problem = await this.problemRepository.findOne({
      where: { id, tenantId, patientId },
    });
    if (!problem) {
      throw new NotFoundException(`Problem with ID "${id}" not found`);
    }
    return problem;
  }

  async createProblem(
    tenantId: string,
    patientId: string,
    dto: CreatePatientProblemDto,
    recordedBy?: string,
  ): Promise<PatientProblem> {
    await this.findOne(tenantId, patientId);

    const problem = new PatientProblem();
    problem.tenantId = tenantId;
    problem.patientId = patientId;
    problem.code = dto.code.toUpperCase().trim();
    problem.codeSystem = dto.codeSystem || DiagnosisCodingSystem.ICD_10_CM;
    problem.description = dto.description.trim();
    problem.clinicalStatus = dto.clinicalStatus || ProblemClinicalStatus.ACTIVE;
    problem.verificationStatus = dto.verificationStatus || ProblemVerificationStatus.CONFIRMED;
    problem.priority = dto.priority || null;
    problem.isChronic = dto.isChronic ?? false;
    problem.onsetDate = dto.onsetDate ? new Date(dto.onsetDate) : null;
    problem.resolutionDate = dto.resolutionDate ? new Date(dto.resolutionDate) : null;
    problem.recordedBy = recordedBy || null;
    problem.notes = dto.notes || null;

    const saved = await this.problemRepository.save(problem);
    this.logger.log(`Problem created for patient ${patientId}: ${saved.id}`);
    return saved;
  }

  async updateProblem(
    tenantId: string,
    patientId: string,
    id: string,
    dto: UpdatePatientProblemDto,
  ): Promise<PatientProblem> {
    const problem = await this.findProblemById(tenantId, patientId, id);

    if (dto.code) problem.code = dto.code.toUpperCase().trim();
    if (dto.codeSystem) problem.codeSystem = dto.codeSystem;
    if (dto.description) problem.description = dto.description.trim();
    if (dto.clinicalStatus) problem.clinicalStatus = dto.clinicalStatus;
    if (dto.verificationStatus) problem.verificationStatus = dto.verificationStatus;
    if (dto.priority !== undefined) problem.priority = dto.priority || null;
    if (dto.isChronic !== undefined) problem.isChronic = dto.isChronic;
    if (dto.onsetDate !== undefined) problem.onsetDate = dto.onsetDate ? new Date(dto.onsetDate) : null;
    if (dto.resolutionDate !== undefined) problem.resolutionDate = dto.resolutionDate ? new Date(dto.resolutionDate) : null;
    if (dto.notes !== undefined) problem.notes = dto.notes || null;

    if (problem.clinicalStatus === ProblemClinicalStatus.RESOLVED && !problem.resolutionDate) {
      problem.resolutionDate = new Date();
    }

    const saved = await this.problemRepository.save(problem);
    this.logger.log(`Problem updated for patient ${patientId}: ${id}`);
    return saved;
  }

  async removeProblem(tenantId: string, patientId: string, id: string): Promise<void> {
    const problem = await this.findProblemById(tenantId, patientId, id);
    await this.problemRepository.softRemove(problem);
    this.logger.log(`Problem soft deleted for patient ${patientId}: ${id}`);
  }
}
