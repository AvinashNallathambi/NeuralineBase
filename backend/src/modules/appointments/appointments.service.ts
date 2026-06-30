import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, FindOptionsWhere, Between } from 'typeorm';
import { Appointment } from './entities/appointment.entity';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { QueryAppointmentDto } from './dto/query-appointment.dto';
import { CreateAppointmentWithWorkflowDto, TransitionAppointmentDto } from './dto/appointment-workflow.dto';
import { WorkflowService } from '../workflow/workflow.service';
import { CreateWorkflowInstanceDto } from '../workflow/dto/workflow-instance.dto';

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AppointmentWithWorkflow extends Appointment {
  workflowInstance?: {
    id: string;
    currentStep: string;
    status: string;
    history: any[];
    availableTransitions: any[];
  };
}

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);
  private readonly ENTITY_TYPE = 'appointment';

  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,
    private readonly workflowService: WorkflowService,
  ) {}

  /**
   * Find all appointments with pagination, search, and filters
   */
  async findAll(
    tenantId: string,
    options: QueryAppointmentDto,
  ): Promise<PaginatedResult<Appointment>> {
    const { page = 1, limit = 20, patientId, providerId, appointmentType, status, startDate, endDate, search } = options;
    const skip = (page - 1) * limit;

    const queryBuilder = this.appointmentRepository
      .createQueryBuilder('appointment')
      .where('appointment.tenantId = :tenantId', { tenantId });

    if (patientId) {
      queryBuilder.andWhere('appointment.patientId = :patientId', { patientId });
    }

    if (providerId) {
      queryBuilder.andWhere('appointment.providerId = :providerId', { providerId });
    }

    if (appointmentType) {
      queryBuilder.andWhere('appointment.appointmentType = :appointmentType', { appointmentType });
    }

    if (status) {
      queryBuilder.andWhere('appointment.status = :status', { status });
    }

    if (startDate && endDate) {
      queryBuilder.andWhere(
        'appointment.startTime BETWEEN :startDate AND :endDate',
        { startDate: new Date(startDate), endDate: new Date(endDate) },
      );
    } else if (startDate) {
      queryBuilder.andWhere('appointment.startTime >= :startDate', { startDate: new Date(startDate) });
    } else if (endDate) {
      queryBuilder.andWhere('appointment.startTime <= :endDate', { endDate: new Date(endDate) });
    }

    if (search) {
      queryBuilder.andWhere(
        '(appointment.notes ILIKE :search OR appointment.reasonForVisit ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    queryBuilder
      .orderBy('appointment.startTime', 'ASC')
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
   * Find a single appointment by ID within a tenant
   */
  async findOne(tenantId: string, id: string): Promise<Appointment> {
    const appointment = await this.appointmentRepository.findOne({
      where: { id, tenantId },
    });

    if (!appointment) {
      throw new NotFoundException(`Appointment with ID "${id}" not found`);
    }

    return appointment;
  }

  /**
   * Find appointment with workflow information
   */
  async findOneWithWorkflow(tenantId: string, id: string): Promise<AppointmentWithWorkflow> {
    const appointment = await this.findOne(tenantId, id);

    try {
      const workflowInstance = await this.workflowService.findInstanceByEntity(
        tenantId,
        this.ENTITY_TYPE,
        id,
      );

      const availableTransitions = await this.workflowService.getAvailableTransitions(
        tenantId,
        this.ENTITY_TYPE,
        id,
      );

      return {
        ...appointment,
        workflowInstance: {
          id: workflowInstance.id,
          currentStep: workflowInstance.currentStep,
          status: workflowInstance.status,
          history: workflowInstance.history,
          availableTransitions,
        },
      };
    } catch (error) {
      // No workflow instance exists yet
      return {
        ...appointment,
        workflowInstance: undefined,
      };
    }
  }

  /**
   * Create a new appointment
   */
  async create(
    tenantId: string,
    dto: CreateAppointmentDto,
    userId?: string,
    userName?: string,
  ): Promise<Appointment> {
    // Check for overlapping appointments for the provider
    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);

    const overlapping = await this.appointmentRepository
      .createQueryBuilder('appointment')
      .where('appointment.tenantId = :tenantId', { tenantId })
      .andWhere('appointment.providerId = :providerId', { providerId: dto.providerId })
      .andWhere(
        '(appointment.startTime < :endTime AND appointment.endTime > :startTime)',
        { startTime, endTime },
      )
      .getOne();

    if (overlapping) {
      throw new ConflictException(
        `Provider has an overlapping appointment during this time slot`,
      );
    }

    const appointment = this.appointmentRepository.create({
      ...dto,
      tenantId,
      status: 'scheduled',
    });

    const saved = await this.appointmentRepository.save(appointment);
    this.logger.log(`Appointment created: ${saved.id} in tenant ${tenantId}`);

    // Auto-create workflow instance if an active template exists
    await this.createWorkflowInstanceIfAvailable(tenantId, saved.id, userId, userName);

    return saved;
  }

  /**
   * Create appointment with workflow initialization
   */
  async createWithWorkflow(
    tenantId: string,
    dto: CreateAppointmentDto,
    workflowDto: CreateAppointmentWithWorkflowDto,
    userId?: string,
    userName?: string,
  ): Promise<AppointmentWithWorkflow> {
    const appointment = await this.create(tenantId, dto, userId, userName);

    // Create or update workflow instance
    const template = await this.workflowService.findActiveTemplateForEntity(
      tenantId,
      this.ENTITY_TYPE,
    );

    if (template) {
      const createInstanceDto: CreateWorkflowInstanceDto = {
        templateId: template.id,
        entityType: this.ENTITY_TYPE,
        entityId: appointment.id,
        currentStep: workflowDto.initialStep || 'scheduled',
      };

      await this.workflowService.createInstance(tenantId, createInstanceDto, userId, userName);
    }

    return this.findOneWithWorkflow(tenantId, appointment.id);
  }

  /**
   * Update an appointment
   */
  async update(
    tenantId: string,
    id: string,
    dto: UpdateAppointmentDto,
  ): Promise<Appointment> {
    const appointment = await this.findOne(tenantId, id);

    // Check for overlapping appointments if time is being updated
    if (dto.startTime || dto.endTime) {
      const startTime = dto.startTime ? new Date(dto.startTime) : appointment.startTime;
      const endTime = dto.endTime ? new Date(dto.endTime) : appointment.endTime;
      const providerId = dto.providerId || appointment.providerId;

      const overlapping = await this.appointmentRepository
        .createQueryBuilder('appointment')
        .where('appointment.tenantId = :tenantId', { tenantId })
        .andWhere('appointment.providerId = :providerId', { providerId })
        .andWhere('appointment.id != :id', { id })
        .andWhere(
          '(appointment.startTime < :endTime AND appointment.endTime > :startTime)',
          { startTime, endTime },
        )
        .getOne();

      if (overlapping) {
        throw new ConflictException(
          `Provider has an overlapping appointment during this time slot`,
        );
      }
    }

    Object.assign(appointment, dto);
    const updated = await this.appointmentRepository.save(appointment);
    this.logger.log(`Appointment updated: ${id} in tenant ${tenantId}`);
    return updated;
  }

  /**
   * Soft delete an appointment
   */
  async softDelete(tenantId: string, id: string): Promise<void> {
    const appointment = await this.findOne(tenantId, id);
    
    // Cancel workflow if exists
    try {
      await this.workflowService.cancelWorkflow(
        tenantId,
        this.ENTITY_TYPE,
        id,
        'Appointment deleted',
      );
    } catch (error) {
      // Workflow might not exist, ignore
    }

    await this.appointmentRepository.softRemove(appointment);
    this.logger.log(`Appointment soft deleted: ${id} in tenant ${tenantId}`);
  }

  /**
   * Transition appointment workflow
   */
  async transitionWorkflow(
    tenantId: string,
    id: string,
    dto: TransitionAppointmentDto,
    userId: string,
    userName: string,
  ): Promise<AppointmentWithWorkflow> {
    await this.workflowService.transition(
      tenantId,
      this.ENTITY_TYPE,
      id,
      dto,
      userId,
      userName,
    );

    // Update appointment status to match workflow step
    const appointment = await this.findOne(tenantId, id);
    appointment.status = dto.toStep;
    await this.appointmentRepository.save(appointment);

    return this.findOneWithWorkflow(tenantId, id);
  }

  /**
   * Get available workflow transitions for an appointment
   */
  async getAvailableTransitions(tenantId: string, id: string): Promise<any[]> {
    return this.workflowService.getAvailableTransitions(
      tenantId,
      this.ENTITY_TYPE,
      id,
    );
  }

  /**
   * Complete appointment workflow
   */
  async completeWorkflow(
    tenantId: string,
    id: string,
  ): Promise<AppointmentWithWorkflow> {
    await this.workflowService.completeWorkflow(
      tenantId,
      this.ENTITY_TYPE,
      id,
    );

    const appointment = await this.findOne(tenantId, id);
    appointment.status = 'completed';
    await this.appointmentRepository.save(appointment);

    return this.findOneWithWorkflow(tenantId, id);
  }

  /**
   * Cancel appointment workflow
   */
  async cancelWorkflow(
    tenantId: string,
    id: string,
    reason?: string,
  ): Promise<AppointmentWithWorkflow> {
    await this.workflowService.cancelWorkflow(
      tenantId,
      this.ENTITY_TYPE,
      id,
      reason,
    );

    const appointment = await this.findOne(tenantId, id);
    appointment.status = 'cancelled';
    await this.appointmentRepository.save(appointment);

    return this.findOneWithWorkflow(tenantId, id);
  }

  /**
   * Helper: Create workflow instance if an active template exists
   */
  private async createWorkflowInstanceIfAvailable(
    tenantId: string,
    appointmentId: string,
    userId?: string,
    userName?: string,
  ): Promise<void> {
    try {
      const template = await this.workflowService.findActiveTemplateForEntity(
        tenantId,
        this.ENTITY_TYPE,
      );

      if (template) {
        const createInstanceDto: CreateWorkflowInstanceDto = {
          templateId: template.id,
          entityType: this.ENTITY_TYPE,
          entityId: appointmentId,
          currentStep: 'scheduled',
        };

        await this.workflowService.createInstance(tenantId, createInstanceDto, userId, userName);
        this.logger.log(`Workflow instance auto-created for appointment ${appointmentId}`);
      }
    } catch (error: any) {
      this.logger.warn(`Failed to auto-create workflow instance: ${error?.message || error}`);
    }
  }
}
