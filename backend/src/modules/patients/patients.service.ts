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
import { PatientAllergy, AllergySeverity, AllergyStatus, AllergyVerificationStatus } from './entities/patient-allergy.entity';
import { PatientFamilyHistory, FamilyMemberRelationship, FamilyHistoryStatus } from './entities/patient-family-history.entity';
import { PatientSurgicalHistory } from './entities/patient-surgical-history.entity';
import { PatientSocialHistory, SocialHistoryCategory } from './entities/patient-social-history.entity';
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
    @InjectRepository(PatientAllergy)
    private readonly allergyRepository: Repository<PatientAllergy>,
    @InjectRepository(PatientFamilyHistory)
    private readonly familyHistoryRepository: Repository<PatientFamilyHistory>,
    @InjectRepository(PatientSurgicalHistory)
    private readonly surgicalHistoryRepository: Repository<PatientSurgicalHistory>,
    @InjectRepository(PatientSocialHistory)
    private readonly socialHistoryRepository: Repository<PatientSocialHistory>,
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

  // ─── Allergies ───────────────────────────────────────────────────

  async findAllergies(tenantId: string, patientId: string, clinicalStatus?: string): Promise<PatientAllergy[]> {
    await this.findOne(tenantId, patientId);
    const qb = this.allergyRepository
      .createQueryBuilder('allergy')
      .where('allergy.tenantId = :tenantId', { tenantId })
      .andWhere('allergy.patientId = :patientId', { patientId })
      .andWhere('allergy.deletedAt IS NULL');
    if (clinicalStatus) {
      qb.andWhere('allergy.clinicalStatus = :clinicalStatus', { clinicalStatus });
    }
    qb.orderBy('allergy.severity', 'DESC').addOrderBy('allergy.createdAt', 'DESC');
    return qb.getMany();
  }

  async findAllergyById(tenantId: string, patientId: string, id: string): Promise<PatientAllergy> {
    const allergy = await this.allergyRepository.findOne({ where: { id, tenantId, patientId } });
    if (!allergy) throw new NotFoundException(`Allergy with ID "${id}" not found`);
    return allergy;
  }

  async createAllergy(
    tenantId: string,
    patientId: string,
    data: {
      allergen: string;
      reaction?: string;
      severity?: AllergySeverity;
      clinicalStatus?: AllergyStatus;
      verificationStatus?: AllergyVerificationStatus;
      onsetDate?: string;
      notes?: string;
      source?: string;
    },
    recordedBy?: string,
  ): Promise<PatientAllergy> {
    await this.findOne(tenantId, patientId);
    const allergy = new PatientAllergy();
    allergy.tenantId = tenantId;
    allergy.patientId = patientId;
    allergy.allergen = data.allergen.trim();
    allergy.reaction = data.reaction || null;
    allergy.severity = data.severity || AllergySeverity.MODERATE;
    allergy.clinicalStatus = data.clinicalStatus || AllergyStatus.ACTIVE;
    allergy.verificationStatus = data.verificationStatus || AllergyVerificationStatus.CONFIRMED;
    allergy.onsetDate = data.onsetDate ? new Date(data.onsetDate) : null;
    allergy.recordedBy = recordedBy || null;
    allergy.source = data.source || 'staff';
    allergy.notes = data.notes || null;
    const saved = await this.allergyRepository.save(allergy);
    this.logger.log(`Allergy created for patient ${patientId}: ${saved.id}`);
    return saved;
  }

  async updateAllergy(
    tenantId: string,
    patientId: string,
    id: string,
    data: Partial<{
      allergen: string;
      reaction: string;
      severity: AllergySeverity;
      clinicalStatus: AllergyStatus;
      verificationStatus: AllergyVerificationStatus;
      onsetDate: string;
      notes: string;
    }>,
  ): Promise<PatientAllergy> {
    const allergy = await this.findAllergyById(tenantId, patientId, id);
    if (data.allergen !== undefined) allergy.allergen = data.allergen.trim();
    if (data.reaction !== undefined) allergy.reaction = data.reaction || null;
    if (data.severity) allergy.severity = data.severity;
    if (data.clinicalStatus) allergy.clinicalStatus = data.clinicalStatus;
    if (data.verificationStatus) allergy.verificationStatus = data.verificationStatus;
    if (data.onsetDate !== undefined) allergy.onsetDate = data.onsetDate ? new Date(data.onsetDate) : null;
    if (data.notes !== undefined) allergy.notes = data.notes || null;
    const saved = await this.allergyRepository.save(allergy);
    this.logger.log(`Allergy updated for patient ${patientId}: ${id}`);
    return saved;
  }

  async removeAllergy(tenantId: string, patientId: string, id: string): Promise<void> {
    const allergy = await this.findAllergyById(tenantId, patientId, id);
    await this.allergyRepository.softRemove(allergy);
    this.logger.log(`Allergy soft deleted for patient ${patientId}: ${id}`);
  }

  // ─── Family History ──────────────────────────────────────────────

  async findFamilyHistory(tenantId: string, patientId: string): Promise<PatientFamilyHistory[]> {
    await this.findOne(tenantId, patientId);
    return this.familyHistoryRepository
      .createQueryBuilder('fh')
      .where('fh.tenantId = :tenantId', { tenantId })
      .andWhere('fh.patientId = :patientId', { patientId })
      .andWhere('fh.deletedAt IS NULL')
      .orderBy('fh.relationship', 'ASC')
      .addOrderBy('fh.createdAt', 'DESC')
      .getMany();
  }

  async findFamilyHistoryById(tenantId: string, patientId: string, id: string): Promise<PatientFamilyHistory> {
    const fh = await this.familyHistoryRepository.findOne({ where: { id, tenantId, patientId } });
    if (!fh) throw new NotFoundException(`Family history entry with ID "${id}" not found`);
    return fh;
  }

  async createFamilyHistory(
    tenantId: string,
    patientId: string,
    data: {
      relationship: FamilyMemberRelationship;
      memberName?: string;
      condition: string;
      code?: string;
      codeSystem?: string;
      ageOfOnset?: number;
      isDeceased?: boolean;
      ageAtDeath?: number;
      notes?: string;
      source?: string;
    },
    recordedBy?: string,
  ): Promise<PatientFamilyHistory> {
    await this.findOne(tenantId, patientId);
    const fh = new PatientFamilyHistory();
    fh.tenantId = tenantId;
    fh.patientId = patientId;
    fh.relationship = data.relationship;
    fh.memberName = data.memberName || null;
    fh.condition = data.condition.trim();
    fh.code = data.code || null;
    fh.codeSystem = data.codeSystem || null;
    fh.ageOfOnset = data.ageOfOnset ?? null;
    fh.isDeceased = data.isDeceased ?? false;
    fh.ageAtDeath = data.ageAtDeath ?? null;
    fh.clinicalStatus = FamilyHistoryStatus.ACTIVE;
    fh.verificationStatus = 'unconfirmed';
    fh.recordedBy = recordedBy || null;
    fh.source = data.source || 'staff';
    fh.notes = data.notes || null;
    const saved = await this.familyHistoryRepository.save(fh);
    this.logger.log(`Family history created for patient ${patientId}: ${saved.id}`);
    return saved;
  }

  async updateFamilyHistory(
    tenantId: string,
    patientId: string,
    id: string,
    data: Partial<{
      relationship: FamilyMemberRelationship;
      memberName: string;
      condition: string;
      code: string;
      codeSystem: string;
      ageOfOnset: number;
      isDeceased: boolean;
      ageAtDeath: number;
      clinicalStatus: FamilyHistoryStatus;
      verificationStatus: string;
      notes: string;
    }>,
  ): Promise<PatientFamilyHistory> {
    const fh = await this.findFamilyHistoryById(tenantId, patientId, id);
    if (data.relationship) fh.relationship = data.relationship;
    if (data.memberName !== undefined) fh.memberName = data.memberName || null;
    if (data.condition) fh.condition = data.condition.trim();
    if (data.code !== undefined) fh.code = data.code || null;
    if (data.codeSystem !== undefined) fh.codeSystem = data.codeSystem || null;
    if (data.ageOfOnset !== undefined) fh.ageOfOnset = data.ageOfOnset;
    if (data.isDeceased !== undefined) fh.isDeceased = data.isDeceased;
    if (data.ageAtDeath !== undefined) fh.ageAtDeath = data.ageAtDeath;
    if (data.clinicalStatus) fh.clinicalStatus = data.clinicalStatus;
    if (data.verificationStatus) fh.verificationStatus = data.verificationStatus;
    if (data.notes !== undefined) fh.notes = data.notes || null;
    const saved = await this.familyHistoryRepository.save(fh);
    this.logger.log(`Family history updated for patient ${patientId}: ${id}`);
    return saved;
  }

  async removeFamilyHistory(tenantId: string, patientId: string, id: string): Promise<void> {
    const fh = await this.findFamilyHistoryById(tenantId, patientId, id);
    await this.familyHistoryRepository.softRemove(fh);
    this.logger.log(`Family history soft deleted for patient ${patientId}: ${id}`);
  }

  // ─── Surgical History ────────────────────────────────────────────

  async findSurgicalHistory(tenantId: string, patientId: string): Promise<PatientSurgicalHistory[]> {
    await this.findOne(tenantId, patientId);
    return this.surgicalHistoryRepository
      .createQueryBuilder('sh')
      .where('sh.tenantId = :tenantId', { tenantId })
      .andWhere('sh.patientId = :patientId', { patientId })
      .andWhere('sh.deletedAt IS NULL')
      .orderBy('sh.procedureDate', 'DESC')
      .addOrderBy('sh.createdAt', 'DESC')
      .getMany();
  }

  async findSurgicalHistoryById(tenantId: string, patientId: string, id: string): Promise<PatientSurgicalHistory> {
    const sh = await this.surgicalHistoryRepository.findOne({ where: { id, tenantId, patientId } });
    if (!sh) throw new NotFoundException(`Surgical history entry with ID "${id}" not found`);
    return sh;
  }

  async createSurgicalHistory(
    tenantId: string,
    patientId: string,
    data: {
      procedure: string;
      procedureCode?: string;
      codeSystem?: string;
      procedureDate?: string;
      surgeon?: string;
      facility?: string;
      bodySite?: string;
      outcome?: string;
      notes?: string;
      source?: string;
    },
    recordedBy?: string,
  ): Promise<PatientSurgicalHistory> {
    await this.findOne(tenantId, patientId);
    const sh = new PatientSurgicalHistory();
    sh.tenantId = tenantId;
    sh.patientId = patientId;
    sh.procedure = data.procedure.trim();
    sh.procedureCode = data.procedureCode || null;
    sh.codeSystem = data.codeSystem || null;
    sh.procedureDate = data.procedureDate ? new Date(data.procedureDate) : null;
    sh.surgeon = data.surgeon || null;
    sh.facility = data.facility || null;
    sh.bodySite = data.bodySite || null;
    sh.outcome = data.outcome || null;
    sh.verificationStatus = 'confirmed';
    sh.recordedBy = recordedBy || null;
    sh.source = data.source || 'staff';
    sh.notes = data.notes || null;
    const saved = await this.surgicalHistoryRepository.save(sh);
    this.logger.log(`Surgical history created for patient ${patientId}: ${saved.id}`);
    return saved;
  }

  async updateSurgicalHistory(
    tenantId: string,
    patientId: string,
    id: string,
    data: Partial<{
      procedure: string;
      procedureCode: string;
      codeSystem: string;
      procedureDate: string;
      surgeon: string;
      facility: string;
      bodySite: string;
      outcome: string;
      verificationStatus: string;
      notes: string;
    }>,
  ): Promise<PatientSurgicalHistory> {
    const sh = await this.findSurgicalHistoryById(tenantId, patientId, id);
    if (data.procedure) sh.procedure = data.procedure.trim();
    if (data.procedureCode !== undefined) sh.procedureCode = data.procedureCode || null;
    if (data.codeSystem !== undefined) sh.codeSystem = data.codeSystem || null;
    if (data.procedureDate !== undefined) sh.procedureDate = data.procedureDate ? new Date(data.procedureDate) : null;
    if (data.surgeon !== undefined) sh.surgeon = data.surgeon || null;
    if (data.facility !== undefined) sh.facility = data.facility || null;
    if (data.bodySite !== undefined) sh.bodySite = data.bodySite || null;
    if (data.outcome !== undefined) sh.outcome = data.outcome || null;
    if (data.verificationStatus) sh.verificationStatus = data.verificationStatus;
    if (data.notes !== undefined) sh.notes = data.notes || null;
    const saved = await this.surgicalHistoryRepository.save(sh);
    this.logger.log(`Surgical history updated for patient ${patientId}: ${id}`);
    return saved;
  }

  async removeSurgicalHistory(tenantId: string, patientId: string, id: string): Promise<void> {
    const sh = await this.findSurgicalHistoryById(tenantId, patientId, id);
    await this.surgicalHistoryRepository.softRemove(sh);
    this.logger.log(`Surgical history soft deleted for patient ${patientId}: ${id}`);
  }

  // ─── Social History ──────────────────────────────────────────────

  async findSocialHistory(tenantId: string, patientId: string, category?: string): Promise<PatientSocialHistory[]> {
    await this.findOne(tenantId, patientId);
    const qb = this.socialHistoryRepository
      .createQueryBuilder('sh')
      .where('sh.tenantId = :tenantId', { tenantId })
      .andWhere('sh.patientId = :patientId', { patientId })
      .andWhere('sh.deletedAt IS NULL');
    if (category) {
      qb.andWhere('sh.category = :category', { category });
    }
    qb.orderBy('sh.category', 'ASC').addOrderBy('sh.createdAt', 'DESC');
    return qb.getMany();
  }

  async findSocialHistoryById(tenantId: string, patientId: string, id: string): Promise<PatientSocialHistory> {
    const sh = await this.socialHistoryRepository.findOne({ where: { id, tenantId, patientId } });
    if (!sh) throw new NotFoundException(`Social history entry with ID "${id}" not found`);
    return sh;
  }

  async createSocialHistory(
    tenantId: string,
    patientId: string,
    data: {
      category: SocialHistoryCategory;
      status?: string;
      detail?: string;
      frequency?: string;
      amount?: string;
      durationYears?: number;
      quitDate?: string;
      notes?: string;
      source?: string;
    },
    recordedBy?: string,
  ): Promise<PatientSocialHistory> {
    await this.findOne(tenantId, patientId);
    const sh = new PatientSocialHistory();
    sh.tenantId = tenantId;
    sh.patientId = patientId;
    sh.category = data.category;
    sh.status = data.status || 'current';
    sh.detail = data.detail || null;
    sh.frequency = data.frequency || null;
    sh.amount = data.amount || null;
    sh.durationYears = data.durationYears ?? null;
    sh.quitDate = data.quitDate ? new Date(data.quitDate) : null;
    sh.verificationStatus = 'confirmed';
    sh.recordedBy = recordedBy || null;
    sh.source = data.source || 'staff';
    sh.notes = data.notes || null;
    const saved = await this.socialHistoryRepository.save(sh);
    this.logger.log(`Social history created for patient ${patientId}: ${saved.id}`);
    return saved;
  }

  async updateSocialHistory(
    tenantId: string,
    patientId: string,
    id: string,
    data: Partial<{
      category: SocialHistoryCategory;
      status: string;
      detail: string;
      frequency: string;
      amount: string;
      durationYears: number;
      quitDate: string;
      verificationStatus: string;
      notes: string;
    }>,
  ): Promise<PatientSocialHistory> {
    const sh = await this.findSocialHistoryById(tenantId, patientId, id);
    if (data.category) sh.category = data.category;
    if (data.status) sh.status = data.status;
    if (data.detail !== undefined) sh.detail = data.detail || null;
    if (data.frequency !== undefined) sh.frequency = data.frequency || null;
    if (data.amount !== undefined) sh.amount = data.amount || null;
    if (data.durationYears !== undefined) sh.durationYears = data.durationYears;
    if (data.quitDate !== undefined) sh.quitDate = data.quitDate ? new Date(data.quitDate) : null;
    if (data.verificationStatus) sh.verificationStatus = data.verificationStatus;
    if (data.notes !== undefined) sh.notes = data.notes || null;
    const saved = await this.socialHistoryRepository.save(sh);
    this.logger.log(`Social history updated for patient ${patientId}: ${id}`);
    return saved;
  }

  async removeSocialHistory(tenantId: string, patientId: string, id: string): Promise<void> {
    const sh = await this.findSocialHistoryById(tenantId, patientId, id);
    await this.socialHistoryRepository.softRemove(sh);
    this.logger.log(`Social history soft deleted for patient ${patientId}: ${id}`);
  }
}
