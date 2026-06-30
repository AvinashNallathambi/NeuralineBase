import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { WorkflowTemplate, WorkflowStepConfig } from './entities/workflow-template.entity';
import { WorkflowInstance, WorkflowTransitionLog } from './entities/workflow-instance.entity';
import { CreateWorkflowTemplateDto } from './dto/create-workflow-template.dto';
import { UpdateWorkflowTemplateDto } from './dto/update-workflow-template.dto';
import { CreateWorkflowInstanceDto, TransitionWorkflowDto } from './dto/workflow-instance.dto';

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);

  constructor(
    @InjectRepository(WorkflowTemplate)
    private readonly templateRepository: Repository<WorkflowTemplate>,
    @InjectRepository(WorkflowInstance)
    private readonly instanceRepository: Repository<WorkflowInstance>,
  ) {}

  // ── Template CRUD ──────────────────────────────────────────────────────────

  async createTemplate(
    tenantId: string,
    dto: CreateWorkflowTemplateDto,
  ): Promise<WorkflowTemplate> {
    const template = this.templateRepository.create({
      ...dto,
      tenantId,
      isActive: dto.isActive ?? true,
    });
    const saved = await this.templateRepository.save(template);
    this.logger.log(`Workflow template created: ${saved.id} in tenant ${tenantId}`);
    return saved;
  }

  async findAllTemplates(
    tenantId: string,
    options: {
      page: number;
      limit: number;
      entityType?: string;
      isActive?: boolean;
      search?: string;
    },
  ): Promise<PaginatedResult<WorkflowTemplate>> {
    const { page, limit, entityType, isActive, search } = options;
    const skip = (page - 1) * limit;

    const queryBuilder = this.templateRepository
      .createQueryBuilder('template')
      .where('template.tenantId = :tenantId', { tenantId })
      .orderBy('template.createdAt', 'DESC');

    if (entityType) {
      queryBuilder.andWhere('template.entityType = :entityType', { entityType });
    }
    if (isActive !== undefined) {
      queryBuilder.andWhere('template.isActive = :isActive', { isActive });
    }
    if (search) {
      queryBuilder.andWhere(
        '(template.name ILIKE :search OR template.description ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    queryBuilder.skip(skip).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findTemplateById(tenantId: string, id: string): Promise<WorkflowTemplate> {
    const template = await this.templateRepository.findOne({
      where: { id, tenantId },
    });
    if (!template) {
      throw new NotFoundException(`Workflow template "${id}" not found`);
    }
    return template;
  }

  async findActiveTemplateForEntity(
    tenantId: string,
    entityType: string,
  ): Promise<WorkflowTemplate | null> {
    return this.templateRepository.findOne({
      where: { tenantId, entityType, isActive: true },
      order: { version: 'DESC' },
    });
  }

  async updateTemplate(
    tenantId: string,
    id: string,
    dto: UpdateWorkflowTemplateDto,
  ): Promise<WorkflowTemplate> {
    const template = await this.findTemplateById(tenantId, id);

    if (dto.steps) {
      this.validateStepOrder(dto.steps);
    }

    Object.assign(template, dto);
    const updated = await this.templateRepository.save(template);
    this.logger.log(`Workflow template updated: ${id} in tenant ${tenantId}`);
    return updated;
  }

  async deleteTemplate(tenantId: string, id: string): Promise<void> {
    const template = await this.findTemplateById(tenantId, id);
    await this.templateRepository.softRemove(template);
    this.logger.log(`Workflow template soft deleted: ${id} in tenant ${tenantId}`);
  }

  // ── Instance CRUD ──────────────────────────────────────────────────────────

  async createInstance(
    tenantId: string,
    dto: CreateWorkflowInstanceDto,
    userId?: string,
    userName?: string,
  ): Promise<WorkflowInstance> {
    const template = await this.findTemplateById(tenantId, dto.templateId);

    const stepNames = template.steps.map((s) => s.name);
    if (!stepNames.includes(dto.currentStep)) {
      throw new BadRequestException(
        `Step "${dto.currentStep}" not found in template steps: [${stepNames.join(', ')}]`,
      );
    }

    const transitionLog: WorkflowTransitionLog = {
      fromStep: '',
      toStep: dto.currentStep,
      timestamp: new Date().toISOString(),
      userId: userId || 'system',
      userName: userName || 'System',
    };

    const instance = this.instanceRepository.create({
      ...dto,
      tenantId,
      history: [transitionLog],
      status: 'active',
    });

    const saved = await this.instanceRepository.save(instance);
    this.logger.log(`Workflow instance created: ${saved.id} for ${dto.entityType}/${dto.entityId}`);
    return saved;
  }

  async findInstanceByEntity(
    tenantId: string,
    entityType: string,
    entityId: string,
  ): Promise<WorkflowInstance> {
    const instance = await this.instanceRepository.findOne({
      where: { tenantId, entityType, entityId },
      relations: ['template'],
    });
    if (!instance) {
      throw new NotFoundException(
        `Workflow instance not found for ${entityType}/${entityId}`,
      );
    }
    return instance;
  }

  async findAllInstances(
    tenantId: string,
    options: {
      page: number;
      limit: number;
      entityType?: string;
      status?: string;
      currentStep?: string;
    },
  ): Promise<PaginatedResult<WorkflowInstance>> {
    const { page, limit, entityType, status, currentStep } = options;
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<WorkflowInstance> = { tenantId };
    if (entityType) where.entityType = entityType;
    if (status) where.status = status;
    if (currentStep) where.currentStep = currentStep;

    const [data, total] = await this.instanceRepository.findAndCount({
      where,
      relations: ['template'],
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ── Transitions ────────────────────────────────────────────────────────────

  async transition(
    tenantId: string,
    entityType: string,
    entityId: string,
    dto: TransitionWorkflowDto,
    userId: string,
    userName: string,
  ): Promise<WorkflowInstance> {
    const instance = await this.findInstanceByEntity(tenantId, entityType, entityId);
    const template = await this.findTemplateById(tenantId, instance.templateId);

    if (instance.status !== 'active') {
      throw new BadRequestException(
        `Cannot transition: workflow instance is "${instance.status}"`,
      );
    }

    const currentStepConfig = template.steps.find(
      (s) => s.name === instance.currentStep,
    );
    if (!currentStepConfig) {
      throw new BadRequestException(
        `Current step "${instance.currentStep}" not found in template`,
      );
    }

    if (!currentStepConfig.allowedTransitions.includes(dto.toStep)) {
      throw new BadRequestException(
        `Cannot transition from "${instance.currentStep}" to "${dto.toStep}". ` +
        `Allowed: [${currentStepConfig.allowedTransitions.join(', ')}]`,
      );
    }

    const transitionLog: WorkflowTransitionLog = {
      fromStep: instance.currentStep,
      toStep: dto.toStep,
      timestamp: new Date().toISOString(),
      userId,
      userName,
      note: dto.note,
    };

    instance.currentStep = dto.toStep;
    instance.history = [...instance.history, transitionLog];

    if (dto.metadata) {
      instance.metadata = { ...instance.metadata, ...dto.metadata };
    }

    const updated = await this.instanceRepository.save(instance);
    this.logger.log(
      `Workflow transition: ${entityType}/${entityId} -> ${dto.toStep}`,
    );
    return updated;
  }

  async getAvailableTransitions(
    tenantId: string,
    entityType: string,
    entityId: string,
  ): Promise<WorkflowStepConfig[]> {
    const instance = await this.findInstanceByEntity(tenantId, entityType, entityId);
    const template = await this.findTemplateById(tenantId, instance.templateId);

    const currentStepConfig = template.steps.find(
      (s) => s.name === instance.currentStep,
    );
    if (!currentStepConfig) {
      return [];
    }

    return template.steps.filter((s) =>
      currentStepConfig.allowedTransitions.includes(s.name),
    );
  }

  async completeWorkflow(
    tenantId: string,
    entityType: string,
    entityId: string,
  ): Promise<WorkflowInstance> {
    const instance = await this.findInstanceByEntity(tenantId, entityType, entityId);
    instance.status = 'completed';
    const saved = await this.instanceRepository.save(instance);
    this.logger.log(`Workflow completed: ${entityType}/${entityId}`);
    return saved;
  }

  async cancelWorkflow(
    tenantId: string,
    entityType: string,
    entityId: string,
    reason?: string,
  ): Promise<WorkflowInstance> {
    const instance = await this.findInstanceByEntity(tenantId, entityType, entityId);
    instance.status = 'cancelled';
    if (reason) {
      instance.metadata = { ...instance.metadata, cancellationReason: reason };
    }
    const saved = await this.instanceRepository.save(instance);
    this.logger.log(`Workflow cancelled: ${entityType}/${entityId}`);
    return saved;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private validateStepOrder(steps: WorkflowStepConfig[]): void {
    const names = steps.map((s) => s.name);
    const uniqueNames = new Set(names);
    if (uniqueNames.size !== names.length) {
      throw new BadRequestException('Step names must be unique');
    }

    for (const step of steps) {
      for (const transition of step.allowedTransitions) {
        if (!names.includes(transition)) {
          throw new BadRequestException(
            `Step "${step.name}" references unknown transition target "${transition}"`,
          );
        }
      }
    }
  }
}
