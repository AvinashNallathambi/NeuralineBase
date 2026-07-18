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
import { Patient } from '../patients/entities/patient.entity';
import { User } from '../users/entities/user.entity';
import { ProviderAvailability } from './entities/provider-availability.entity';
import { ProviderAvailabilityOverride } from './entities/provider-availability-override.entity';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { QueryAppointmentDto } from './dto/query-appointment.dto';
import { CreateAppointmentWithWorkflowDto, TransitionAppointmentDto } from './dto/appointment-workflow.dto';
import { CreateProviderAvailabilityDto, UpdateProviderAvailabilityDto, CreateGroupAppointmentDto, UpdateGroupAppointmentDto } from './dto/provider-availability.dto';
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
    @InjectRepository(ProviderAvailability)
    private readonly availabilityRepository: Repository<ProviderAvailability>,
    @InjectRepository(ProviderAvailabilityOverride)
    private readonly overrideRepository: Repository<ProviderAvailabilityOverride>,
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly workflowService: WorkflowService,
  ) {}

  /**
   * Find all appointments with pagination, search, and filters
   */
  async findAll(
    tenantId: string,
    options: QueryAppointmentDto,
  ): Promise<PaginatedResult<Appointment>> {
    const { page = 1, limit = 20, patientId, providerId, appointmentType, type, status, startDate, endDate, search } = options;
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

    const apptType = type || appointmentType;
    if (apptType) {
      queryBuilder.andWhere('appointment.appointmentType = :appointmentType', { appointmentType: apptType });
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

    // Backfill patientName for existing records that lack the denormalized column
    const pendingIds = data
      .filter((a) => a.patientId && !a.patientName)
      .map((a) => a.patientId);
    if (pendingIds.length > 0) {
      const patients = await this.patientRepository
        .createQueryBuilder('patient')
        .where('patient.id IN (:...ids)', { ids: pendingIds })
        .getMany();
      const nameMap = new Map(patients.map((p) => [p.id, `${p.firstName} ${p.lastName}`]));
      for (const appointment of data) {
        if (!appointment.patientName && appointment.patientId) {
          appointment.patientName = nameMap.get(appointment.patientId) || null;
        }
      }
    }

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

    if (!appointment.patientName && appointment.patientId) {
      const patient = await this.patientRepository.findOne({
        where: { id: appointment.patientId, tenantId },
      });
      appointment.patientName = patient ? `${patient.firstName} ${patient.lastName}` : null;
    }

    // Resolve providerName from the Users table (Settings → Users & Roles) when
    // it is missing or stored as a raw UUID fallback. This ensures group
    // appointments (which are created without a provider name) display the
    // assigned provider correctly in the Appointment Details view.
    if ((!appointment.providerName || appointment.providerName === appointment.providerId) && appointment.providerId) {
      const user = await this.userRepository.findOne({
        where: { id: appointment.providerId, tenantId },
      });
      if (user) {
        appointment.providerName = `${user.firstName} ${user.lastName}`.trim() || user.email;
      }
    }

    // For group appointments, resolve participant names from the Patients
    // table so the details view can render them instead of placeholder text.
    if (appointment.isGroup && appointment.groupParticipants && appointment.groupParticipants.length > 0) {
      const participantIds = appointment.groupParticipants.map((p) => p.patientId);
      const patientRecords = await this.patientRepository.find({
        where: participantIds.map((pid) => ({ id: pid, tenantId })) as FindOptionsWhere<Patient>[],
      });
      const nameById = new Map(patientRecords.map((p) => [p.id, `${p.firstName} ${p.lastName}`]));
      appointment.groupParticipants = appointment.groupParticipants.map((p) => ({
        ...p,
        patientName: nameById.get(p.patientId) || p.patientName,
      }));
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

    // Look up patient name for denormalized storage
    let patientName: string | null = null;
    if (dto.patientId) {
      const patient = await this.patientRepository.findOne({
        where: { id: dto.patientId, tenantId },
      });
      if (patient) {
        patientName = `${patient.firstName} ${patient.lastName}`;
      }
    }

    // Look up provider name — fall back to providerId as display name
    let providerName: string | null = dto.providerId;
    // In future: look up from a Users/Providers table

    const appointment = this.appointmentRepository.create({
      patientId: dto.patientId,
      patientName,
      providerId: dto.providerId,
      providerName,
      appointmentType: dto.type || dto.appointmentType,
      startTime: new Date(dto.startTime),
      endTime: new Date(dto.endTime),
      location: dto.location,
      notes: dto.notes,
      reasonForVisit: dto.reason || dto.reasonForVisit,
      isTelehealth: dto.isTelehealth ?? false,
      durationMinutes: dto.durationMinutes ?? null,
      remindersEnabled: dto.remindersEnabled ?? true,
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

    // Map frontend field aliases to entity properties
    const newType = dto.type || dto.appointmentType;
    if (newType) {
      appointment.appointmentType = newType;
    }
    const newReason = dto.reason || dto.reasonForVisit;
    if (newReason) {
      appointment.reasonForVisit = newReason || null;
    }
    if (dto.patientId && dto.patientId !== appointment.patientId) {
      appointment.patientId = dto.patientId;
      const patient = await this.patientRepository.findOne({
        where: { id: dto.patientId, tenantId },
      });
      appointment.patientName = patient ? `${patient.firstName} ${patient.lastName}` : null;
    }
    if (dto.providerId && dto.providerId !== appointment.providerId) {
      appointment.providerId = dto.providerId;
      appointment.providerName = dto.providerId;
    }
    if (dto.startTime) appointment.startTime = new Date(dto.startTime);
    if (dto.endTime) appointment.endTime = new Date(dto.endTime);
    if (dto.location !== undefined) appointment.location = dto.location;
    if (dto.notes !== undefined) appointment.notes = dto.notes;
    if (dto.isTelehealth !== undefined) appointment.isTelehealth = dto.isTelehealth;
    if (dto.durationMinutes !== undefined) appointment.durationMinutes = dto.durationMinutes;
    if (dto.remindersEnabled !== undefined) appointment.remindersEnabled = dto.remindersEnabled;
    if (dto.metadata !== undefined) appointment.metadata = dto.metadata;

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

  // ── Provider Availability Methods ─────────────────────────────────────────────

  /**
   * Create provider availability
   */
  async createAvailability(
    tenantId: string,
    dto: CreateProviderAvailabilityDto,
  ): Promise<ProviderAvailability> {
    const availability = this.availabilityRepository.create({
      ...dto,
      tenantId,
    });

    const saved = await this.availabilityRepository.save(availability);
    this.logger.log(`Provider availability created: ${saved.id} for provider ${dto.providerId}`);
    return saved;
  }

  /**
   * Find all availability for a provider
   */
  async findAvailabilityByProvider(
    tenantId: string,
    providerId: string,
  ): Promise<ProviderAvailability[]> {
    return this.availabilityRepository.find({
      where: { tenantId, providerId },
      order: { dayOfWeek: 'ASC', startTime: 'ASC' },
    });
  }

  /**
   * Find all availability records for the tenant (across all providers)
   */
  async findAllAvailability(tenantId: string): Promise<ProviderAvailability[]> {
    return this.availabilityRepository.find({
      where: { tenantId },
      order: { providerId: 'ASC', dayOfWeek: 'ASC', startTime: 'ASC' },
    });
  }

  /**
   * Find all override records for the tenant (across all providers)
   */
  async findAllOverrides(tenantId: string): Promise<ProviderAvailabilityOverride[]> {
    return this.overrideRepository.find({
      where: { tenantId },
      order: { overrideDate: 'ASC', providerId: 'ASC' },
    });
  }

  /**
   * Find availability for a provider on a specific day
   */
  async findAvailabilityByProviderAndDay(
    tenantId: string,
    providerId: string,
    dayOfWeek: number,
  ): Promise<ProviderAvailability[]> {
    return this.availabilityRepository.find({
      where: { tenantId, providerId, dayOfWeek },
      order: { startTime: 'ASC' },
    });
  }

  /**
   * Update provider availability
   */
  async updateAvailability(
    tenantId: string,
    id: string,
    dto: UpdateProviderAvailabilityDto,
  ): Promise<ProviderAvailability> {
    const availability = await this.availabilityRepository.findOne({
      where: { id, tenantId },
    });

    if (!availability) {
      throw new NotFoundException(`Availability with ID "${id}" not found`);
    }

    Object.assign(availability, dto);
    const updated = await this.availabilityRepository.save(availability);
    this.logger.log(`Provider availability updated: ${id}`);
    return updated;
  }

  /**
   * Delete provider availability
   */
  async deleteAvailability(tenantId: string, id: string): Promise<void> {
    const availability = await this.availabilityRepository.findOne({
      where: { id, tenantId },
    });

    if (!availability) {
      throw new NotFoundException(`Availability with ID "${id}" not found`);
    }

    await this.availabilityRepository.remove(availability);
    this.logger.log(`Provider availability deleted: ${id}`);
  }

  /**
   * Get available time slots for a provider on a specific date
   */
  async getAvailableSlots(
    tenantId: string,
    providerId: string,
    date: Date,
    appointmentType?: string,
  ): Promise<{ start: string; end: string }[]> {
    const dayOfWeek = date.getDay();
    const availabilities = await this.findAvailabilityByProviderAndDay(
      tenantId,
      providerId,
      dayOfWeek,
    );

    const slots: { start: string; end: string }[] = [];

    for (const availability of availabilities) {
      if (!availability.isAvailable) continue;

      // Filter by appointment type if specified
      if (appointmentType && availability.appointmentTypes?.length > 0) {
        if (!availability.appointmentTypes.includes(appointmentType)) continue;
      }

      // Check effective and expiry dates
      if (availability.effectiveDate && date < availability.effectiveDate) continue;
      if (availability.expiryDate && date > availability.expiryDate) continue;

      // Get existing appointments for this slot
      const startTime = new Date(date);
      const [hours, minutes] = availability.startTime.split(':').map(Number);
      startTime.setHours(hours, minutes, 0, 0);

      const endTime = new Date(date);
      const [endHours, endMinutes] = availability.endTime.split(':').map(Number);
      endTime.setHours(endHours, endMinutes, 0, 0);

      const existingAppointments = await this.appointmentRepository
        .createQueryBuilder('appointment')
        .where('appointment.tenantId = :tenantId', { tenantId })
        .andWhere('appointment.providerId = :providerId', { providerId })
        .andWhere('appointment.status NOT IN (:...statuses)', { statuses: ['cancelled', 'no_show'] })
        .andWhere(
          '(appointment.startTime < :endTime AND appointment.endTime > :startTime)',
          { startTime, endTime },
        )
        .getCount();

      // Check max appointments limit
      if (availability.maxAppointments && existingAppointments >= availability.maxAppointments) {
        continue;
      }

      slots.push({
        start: availability.startTime,
        end: availability.endTime,
      });
    }

    return slots;
  }

  // ── Group Appointment Methods ────────────────────────────────────────────────

  /**
   * Create a group appointment
   */
  async createGroupAppointment(
    tenantId: string,
    dto: CreateGroupAppointmentDto,
    userId?: string,
    userName?: string,
  ): Promise<Appointment> {
    const groupId = crypto.randomUUID();

    // Resolve the provider's display name from the Users table so the
    // Appointment Details view can show the assigned provider for group sessions.
    let providerName: string | null = null;
    if (dto.providerId) {
      const user = await this.userRepository.findOne({
        where: { id: dto.providerId, tenantId },
      });
      if (user) {
        providerName = `${user.firstName} ${user.lastName}`.trim() || user.email;
      }
    }

    // Resolve patient names up-front so groupParticipants are populated with
    // real names instead of placeholder text.
    const patientRecords = dto.patientIds.length > 0
      ? await this.patientRepository.find({
          where: dto.patientIds.map((pid) => ({ id: pid, tenantId })) as FindOptionsWhere<Patient>[],
        })
      : [];
    const patientNameById = new Map(patientRecords.map((p) => [p.id, `${p.firstName} ${p.lastName}`]));

    // Create individual appointments for each patient
    const appointments: Appointment[] = [];
    const groupParticipants: { patientId: string; patientName: string; attended: boolean; notes?: string }[] = [];

    for (const patientId of dto.patientIds) {
      const appointment = this.appointmentRepository.create({
        patientId,
        providerId: dto.providerId,
        providerName,
        patientName: patientNameById.get(patientId) || null,
        appointmentType: dto.appointmentType,
        startTime: new Date(dto.startTime),
        endTime: new Date(dto.endTime),
        location: dto.location ? { type: dto.location as any } : null,
        notes: dto.notes,
        isTelehealth: dto.isTelehealth ?? false,
        tenantId,
        status: 'scheduled',
        isGroup: true,
        groupId,
        maxParticipants: dto.maxParticipants,
        groupParticipants: null, // Will be set on the main appointment
      });

      const saved = await this.appointmentRepository.save(appointment);
      appointments.push(saved);

      groupParticipants.push({
        patientId,
        patientName: patientNameById.get(patientId) || `Patient ${patientId}`,
        attended: false,
      });
    }

    // Update the first appointment with full group participant list
    const mainAppointment = appointments[0];
    mainAppointment.groupParticipants = groupParticipants;
    await this.appointmentRepository.save(mainAppointment);

    // Auto-create workflow instance for each appointment
    for (const appointment of appointments) {
      await this.createWorkflowInstanceIfAvailable(tenantId, appointment.id, userId, userName);
    }

    this.logger.log(`Group appointment created: ${groupId} with ${appointments.length} participants`);
    return mainAppointment;
  }

  /**
   * Update a group appointment
   */
  async updateGroupAppointment(
    tenantId: string,
    id: string,
    dto: UpdateGroupAppointmentDto,
  ): Promise<Appointment> {
    const appointment = await this.findOne(tenantId, id);

    if (!appointment.isGroup || !appointment.groupId) {
      throw new BadRequestException('This is not a group appointment');
    }

    // Get all appointments in the group
    const groupAppointments = await this.appointmentRepository.find({
      where: { tenantId, groupId: appointment.groupId },
    });

    // Add new patients
    if (dto.addPatientIds && dto.addPatientIds.length > 0) {
      for (const patientId of dto.addPatientIds) {
        const newAppointment = this.appointmentRepository.create({
          patientId,
          providerId: appointment.providerId,
          appointmentType: appointment.appointmentType,
          startTime: appointment.startTime,
          endTime: appointment.endTime,
          location: appointment.location,
          notes: appointment.notes,
          isTelehealth: appointment.isTelehealth,
          tenantId,
          status: 'scheduled',
          isGroup: true,
          groupId: appointment.groupId,
          maxParticipants: appointment.maxParticipants,
          groupParticipants: null,
        });

        await this.appointmentRepository.save(newAppointment);
      }
    }

    // Remove patients
    if (dto.removePatientIds && dto.removePatientIds.length > 0) {
      for (const patientId of dto.removePatientIds) {
        const toRemove = groupAppointments.find((a) => a.patientId === patientId);
        if (toRemove) {
          await this.appointmentRepository.softRemove(toRemove);
        }
      }
    }

    // Update status for all group appointments
    if (dto.status) {
      for (const groupAppt of groupAppointments) {
        groupAppt.status = dto.status;
        await this.appointmentRepository.save(groupAppt);
      }
    }

    // Update notes for all group appointments
    if (dto.notes !== undefined) {
      for (const groupAppt of groupAppointments) {
        groupAppt.notes = dto.notes;
        await this.appointmentRepository.save(groupAppt);
      }
    }

    // Refresh and return the main appointment
    return this.findOne(tenantId, id);
  }

  /**
   * Find all appointments in a group
   */
  async findGroupAppointments(
    tenantId: string,
    groupId: string,
  ): Promise<Appointment[]> {
    return this.appointmentRepository.find({
      where: { tenantId, groupId },
      order: { startTime: 'ASC' },
    });
  }

  /**
   * Mark patient attendance in a group appointment
   */
  async markGroupAttendance(
    tenantId: string,
    appointmentId: string,
    patientId: string,
    attended: boolean,
    notes?: string,
  ): Promise<Appointment> {
    const appointment = await this.findOne(tenantId, appointmentId);

    if (!appointment.isGroup || !appointment.groupParticipants) {
      throw new BadRequestException('This is not a group appointment');
    }

    const participant = appointment.groupParticipants.find((p) => p.patientId === patientId);
    if (!participant) {
      throw new NotFoundException('Patient not found in group appointment');
    }

    participant.attended = attended;
    if (notes) participant.notes = notes;

    return this.appointmentRepository.save(appointment);
  }
}
