import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ClinicalTemplate,
  ClinicalTemplateStatus,
} from './entities/clinical-template.entity';
import { CreateClinicalTemplateDto } from './dto/create-clinical-template.dto';
import { UpdateClinicalTemplateDto } from './dto/update-clinical-template.dto';

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface FindAllOptions {
  page: number;
  limit: number;
  search?: string;
  specialty?: string;
  visitType?: string;
  department?: string;
  isFavorite?: boolean;
  recentlyUsed?: boolean;
  status?: ClinicalTemplateStatus;
  sort?: string;
}

@Injectable()
export class ClinicalTemplateService {
  private readonly logger = new Logger(ClinicalTemplateService.name);

  constructor(
    @InjectRepository(ClinicalTemplate)
    private readonly repository: Repository<ClinicalTemplate>,
  ) {}

  async create(
    tenantId: string,
    dto: CreateClinicalTemplateDto,
    createdBy?: string,
    createdByName?: string,
  ): Promise<ClinicalTemplate> {
    if (dto.isDefault) {
      await this.clearExistingDefault(tenantId, dto.specialty, dto.visitType);
    }
    const template = this.repository.create({
      ...dto,
      tenantId,
      createdBy: createdBy || null,
      createdByName: createdByName || null,
      status: dto.status ?? ClinicalTemplateStatus.ACTIVE,
      isDefault: dto.isDefault ?? false,
      isFavorite: dto.isFavorite ?? false,
      icon: dto.icon || 'FileTextOutlined',
    });
    const saved = await this.repository.save(template);
    this.logger.log(`Clinical template created: ${saved.id} in tenant ${tenantId}`);
    return saved;
  }

  async findAll(
    tenantId: string,
    options: FindAllOptions,
  ): Promise<PaginatedResult<ClinicalTemplate>> {
    const { page, limit, search, specialty, visitType, department, isFavorite, recentlyUsed, status, sort } = options;
    const skip = (page - 1) * limit;

    const qb = this.repository
      .createQueryBuilder('template')
      .where('template.tenantId = :tenantId', { tenantId });

    if (status) {
      qb.andWhere('template.status = :status', { status });
    } else {
      qb.andWhere('template.status = :status', { status: ClinicalTemplateStatus.ACTIVE });
    }

    if (specialty && specialty !== 'all') {
      qb.andWhere('template.specialty = :specialty', { specialty });
    }

    if (visitType && visitType !== 'all') {
      qb.andWhere('template.visitType = :visitType', { visitType });
    }

    if (department && department !== 'all') {
      qb.andWhere('template.department = :department', { department });
    }

    if (isFavorite) {
      qb.andWhere('template.isFavorite = :isFavorite', { isFavorite: true });
    }

    if (recentlyUsed) {
      qb.andWhere('template.lastUsedAt IS NOT NULL');
      qb.orderBy('template.lastUsedAt', 'DESC');
    } else {
      const sortBy = sort || 'name';
      if (sortBy === 'name') {
        qb.orderBy('template.name', 'ASC');
      } else if (sortBy === 'recentlyUsed') {
        qb.orderBy('template.lastUsedAt', 'DESC', 'NULLS LAST');
      } else if (sortBy === 'mostUsed') {
        qb.orderBy('template.usageCount', 'DESC');
      } else if (sortBy === 'newest') {
        qb.orderBy('template.createdAt', 'DESC');
      } else if (sortBy === 'specialty') {
        qb.orderBy('template.specialty', 'ASC');
      } else {
        qb.orderBy('template.name', 'ASC');
      }
    }

    if (search) {
      qb.andWhere(
        '(template.name ILIKE :search OR template.description ILIKE :search OR template.specialty ILIKE :search OR template.visitType ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    qb.skip(skip).take(limit);
    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(tenantId: string, id: string): Promise<ClinicalTemplate> {
    const template = await this.repository.findOne({ where: { id, tenantId } });
    if (!template) {
      throw new NotFoundException(`Clinical template "${id}" not found`);
    }
    return template;
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateClinicalTemplateDto,
  ): Promise<ClinicalTemplate> {
    const template = await this.findOne(tenantId, id);
    if (dto.isDefault && !template.isDefault) {
      await this.clearExistingDefault(tenantId, template.specialty, template.visitType, id);
    }
    Object.assign(template, dto);
    const saved = await this.repository.save(template);
    this.logger.log(`Clinical template updated: ${saved.id}`);
    return saved;
  }

  async duplicate(tenantId: string, id: string, createdBy?: string, createdByName?: string): Promise<ClinicalTemplate> {
    const source = await this.findOne(tenantId, id);
    const copy = this.repository.create({
      tenantId,
      name: `${source.name} (Copy)`,
      specialty: source.specialty,
      visitType: source.visitType,
      description: source.description,
      icon: source.icon,
      isDefault: false,
      isFavorite: false,
      usageCount: 0,
      status: ClinicalTemplateStatus.ACTIVE,
      encounterType: source.encounterType,
      visitReason: source.visitReason,
      chiefComplaint: source.chiefComplaint,
      soapTemplate: source.soapTemplate,
      vitalsTemplate: source.vitalsTemplate,
      diagnosisTemplate: source.diagnosisTemplate,
      medicationTemplate: source.medicationTemplate,
      ordersTemplate: source.ordersTemplate,
      treatmentPlanTemplate: source.treatmentPlanTemplate,
      patientInstructions: source.patientInstructions,
      billingCodes: source.billingCodes,
      providerNotes: source.providerNotes,
      createdBy: createdBy || null,
      createdByName: createdByName || null,
    });
    const saved = await this.repository.save(copy);
    this.logger.log(`Clinical template duplicated: ${source.id} -> ${saved.id}`);
    return saved;
  }

  async archive(tenantId: string, id: string): Promise<ClinicalTemplate> {
    const template = await this.findOne(tenantId, id);
    template.status = ClinicalTemplateStatus.ARCHIVED;
    if (template.isDefault) {
      template.isDefault = false;
    }
    return this.repository.save(template);
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const template = await this.findOne(tenantId, id);
    await this.repository.softRemove(template);
    this.logger.log(`Clinical template soft-deleted: ${id}`);
  }

  async setDefault(tenantId: string, id: string): Promise<ClinicalTemplate> {
    const template = await this.findOne(tenantId, id);
    await this.clearExistingDefault(tenantId, template.specialty, template.visitType, id);
    template.isDefault = true;
    return this.repository.save(template);
  }

  async toggleFavorite(tenantId: string, id: string): Promise<ClinicalTemplate> {
    const template = await this.findOne(tenantId, id);
    template.isFavorite = !template.isFavorite;
    return this.repository.save(template);
  }

  async recordUsage(tenantId: string, id: string): Promise<ClinicalTemplate> {
    const template = await this.findOne(tenantId, id);
    template.usageCount = (template.usageCount || 0) + 1;
    template.lastUsedAt = new Date();
    return this.repository.save(template);
  }

  async apply(
    tenantId: string,
    id: string,
  ): Promise<{ template: ClinicalTemplate }> {
    const template = await this.findOne(tenantId, id);
    return { template };
  }

  async findSpecialties(tenantId: string): Promise<string[]> {
    const rows = await this.repository
      .createQueryBuilder('t')
      .select('DISTINCT t.specialty', 'specialty')
      .where('t.tenantId = :tenantId', { tenantId })
      .andWhere('t.status = :status', { status: ClinicalTemplateStatus.ACTIVE })
      .orderBy('t.specialty', 'ASC')
      .getRawMany<{ specialty: string }>();
    return rows.map((r) => r.specialty).filter(Boolean);
  }

  async findVisitTypes(tenantId: string): Promise<string[]> {
    const rows = await this.repository
      .createQueryBuilder('t')
      .select('DISTINCT t.visitType', 'visitType')
      .where('t.tenantId = :tenantId', { tenantId })
      .andWhere('t.status = :status', { status: ClinicalTemplateStatus.ACTIVE })
      .orderBy('t.visitType', 'ASC')
      .getRawMany<{ visitType: string }>();
    return rows.map((r) => r.visitType).filter(Boolean);
  }

  async findDepartments(tenantId: string): Promise<string[]> {
    const rows = await this.repository
      .createQueryBuilder('t')
      .select('DISTINCT t.department', 'department')
      .where('t.tenantId = :tenantId', { tenantId })
      .andWhere('t.status = :status', { status: ClinicalTemplateStatus.ACTIVE })
      .andWhere('t.department IS NOT NULL')
      .orderBy('t.department', 'ASC')
      .getRawMany<{ department: string }>();
    return rows.map((r) => r.department).filter(Boolean);
  }

  private async clearExistingDefault(
    tenantId: string,
    specialty: string,
    visitType: string,
    excludeId?: string,
  ): Promise<void> {
    const qb = this.repository
      .createQueryBuilder('t')
      .where('t.tenantId = :tenantId', { tenantId })
      .andWhere('t.specialty = :specialty', { specialty })
      .andWhere('t.visitType = :visitType', { visitType })
      .andWhere('t.isDefault = :isDefault', { isDefault: true });
    if (excludeId) {
      qb.andWhere('t.id != :excludeId', { excludeId });
    }
    const existing = await qb.getMany();
    if (existing.length > 0) {
      await this.repository.save(
        existing.map((t) => ({ ...t, isDefault: false })),
      );
    }
  }
}
