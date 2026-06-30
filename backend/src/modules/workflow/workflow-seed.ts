import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkflowTemplate } from './entities/workflow-template.entity';

/**
 * Seeds the default appointment workflow template on application bootstrap
 * if one does not already exist.
 */
@Injectable()
export class WorkflowSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(WorkflowSeedService.name);

  constructor(
    @InjectRepository(WorkflowTemplate)
    private readonly templateRepository: Repository<WorkflowTemplate>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const existing = await this.templateRepository.findOne({
      where: { entityType: 'appointment', tenantId: '00000000-0000-0000-0000-000000000000' },
    });

    if (existing) {
      this.logger.log('Default appointment workflow already exists, skipping seed');
      return;
    }

    const defaultWorkflow = this.templateRepository.create({
      tenantId: '00000000-0000-0000-0000-000000000000',
      name: 'Default Appointment Workflow',
      description: 'Standard appointment lifecycle: scheduled → confirmed → checked in → in progress → completed',
      entityType: 'appointment',
      version: 1,
      isActive: true,
      steps: [
        {
          name: 'scheduled',
          label: 'Scheduled',
          order: 0,
          color: 'blue',
          icon: 'CalendarOutlined',
          allowedTransitions: ['confirmed', 'cancelled', 'no_show'],
          assignableRoles: ['admin', 'receptionist'],
        },
        {
          name: 'confirmed',
          label: 'Confirmed',
          order: 1,
          color: 'cyan',
          icon: 'CheckCircleOutlined',
          allowedTransitions: ['checked_in', 'cancelled', 'no_show'],
          requiredFields: [],
          assignableRoles: ['admin', 'receptionist'],
        },
        {
          name: 'checked_in',
          label: 'Checked In',
          order: 2,
          color: 'geekblue',
          icon: 'LoginOutlined',
          allowedTransitions: ['in_progress', 'cancelled', 'no_show'],
          assignableRoles: ['admin', 'receptionist', 'nurse'],
        },
        {
          name: 'in_progress',
          label: 'In Progress',
          order: 3,
          color: 'orange',
          icon: 'PlayCircleOutlined',
          allowedTransitions: ['completed'],
          assignableRoles: ['doctor', 'nurse'],
        },
        {
          name: 'completed',
          label: 'Completed',
          order: 4,
          color: 'green',
          icon: 'FlagOutlined',
          allowedTransitions: [],
          assignableRoles: ['doctor', 'nurse'],
        },
        {
          name: 'cancelled',
          label: 'Cancelled',
          order: 5,
          color: 'default',
          icon: 'CloseCircleOutlined',
          allowedTransitions: [],
          assignableRoles: ['admin', 'receptionist', 'doctor'],
        },
        {
          name: 'no_show',
          label: 'No Show',
          order: 6,
          color: 'red',
          icon: 'MinusCircleOutlined',
          allowedTransitions: [],
          assignableRoles: ['admin', 'receptionist'],
        },
      ],
      transitions: [
        { fromStep: 'scheduled', toStep: 'confirmed', label: 'Confirm Appointment', requireConfirmation: true },
        { fromStep: 'scheduled', toStep: 'cancelled', label: 'Cancel Appointment', requireConfirmation: true, requireNote: true },
        { fromStep: 'scheduled', toStep: 'no_show', label: 'Mark No Show', requireConfirmation: true, requireNote: true },
        { fromStep: 'confirmed', toStep: 'checked_in', label: 'Check In Patient', requireConfirmation: false },
        { fromStep: 'confirmed', toStep: 'cancelled', label: 'Cancel Appointment', requireConfirmation: true, requireNote: true },
        { fromStep: 'confirmed', toStep: 'no_show', label: 'Mark No Show', requireConfirmation: true, requireNote: true },
        { fromStep: 'checked_in', toStep: 'in_progress', label: 'Start Appointment', requireConfirmation: false },
        { fromStep: 'checked_in', toStep: 'cancelled', label: 'Cancel Appointment', requireConfirmation: true, requireNote: true },
        { fromStep: 'checked_in', toStep: 'no_show', label: 'Mark No Show', requireConfirmation: true, requireNote: true },
        { fromStep: 'in_progress', toStep: 'completed', label: 'Complete Appointment', requireConfirmation: false },
      ],
    });

    await this.templateRepository.save(defaultWorkflow);
    this.logger.log('Default appointment workflow template seeded successfully');
  }
}
