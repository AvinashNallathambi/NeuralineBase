import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';

export type TaskStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'overdue'
  | 'no_response';

export type TaskType =
  | 'monitoring' // Track a vital/metric (BP, glucose, weight)
  | 'lab_order' // Order/repeat a lab test
  | 'imaging_order' // Order/repeat imaging
  | 'medication_adherence' // Confirm medication is being taken
  | 'patient_education' // Read/watch educational content
  | 'questionnaire' // Complete a health questionnaire/survey
  | 'appointment' // Schedule/attend an appointment
  | 'care_team_action' // Action for a care team member
  | 'lifestyle' // Diet, exercise, lifestyle change
  | 'follow_up' // Follow-up visit or call
  | 'referral' // Referral to specialist
  | 'custom'; // Free-form task

export type TaskFrequency =
  | 'one_time'
  | 'daily'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'quarterly'
  | 'annually'
  | 'as_needed';

export type TaskAssignedTo = 'patient' | 'care_team' | 'system';

@Entity('care_plan_tasks')
@Index(['tenantId', 'carePlanId'])
@Index(['tenantId', 'patientId'])
@Index(['tenantId', 'patientId', 'status'])
@Index(['tenantId', 'patientId', 'assignedTo'])
@Index(['tenantId', 'assignedTo', 'status'])
export class CarePlanTask {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'care_plan_id', type: 'uuid' })
  carePlanId!: string;

  @Column({ name: 'patient_id', type: 'varchar', length: 100 })
  patientId!: string;

  /** Task title/summary */
  @Column({ name: 'title', type: 'varchar', length: 255 })
  title!: string;

  /** Detailed description/instructions */
  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'task_type', type: 'varchar', length: 30, default: 'custom' })
  taskType!: TaskType;

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'pending' })
  status!: TaskStatus;

  /** Who is responsible for completing this task */
  @Column({ name: 'assigned_to', type: 'varchar', length: 20, default: 'patient' })
  assignedTo!: TaskAssignedTo;

  /** Provider/care team member ID if assigned to care team */
  @Column({ name: 'assigned_provider_id', type: 'varchar', length: 100, nullable: true })
  assignedProviderId!: string | null;

  @Column({ name: 'assigned_provider_name', type: 'varchar', length: 200, nullable: true })
  assignedProviderName!: string | null;

  /** How often this task should be performed */
  @Column({ name: 'frequency', type: 'varchar', length: 20, default: 'one_time' })
  frequency!: TaskFrequency;

  /** When the task should start */
  @Column({ name: 'start_date', type: 'timestamptz', nullable: true })
  startDate!: Date | null;

  /** When the task is due */
  @Column({ name: 'due_date', type: 'timestamptz', nullable: true })
  dueDate!: Date | null;

  /** When the task was completed */
  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  /** Who completed the task */
  @Column({ name: 'completed_by', type: 'varchar', length: 200, nullable: true })
  completedBy!: string | null;

  /** For monitoring tasks: what metric to track (e.g. "blood_pressure", "glucose", "weight") */
  @Column({ name: 'metric_name', type: 'varchar', length: 100, nullable: true })
  metricName!: string | null;

  /** For monitoring tasks: target value */
  @Column({ name: 'target_value', type: 'varchar', length: 100, nullable: true })
  targetValue!: string | null;

  @Column({ name: 'target_unit', type: 'varchar', length: 50, nullable: true })
  targetUnit!: string | null;

  /** Patient-reported value (when patient reports via portal) */
  @Column({ name: 'reported_value', type: 'varchar', length: 100, nullable: true })
  reportedValue!: string | null;

  @Column({ name: 'reported_at', type: 'timestamptz', nullable: true })
  reportedAt!: Date | null;

  /** Patient notes when reporting */
  @Column({ name: 'patient_notes', type: 'text', nullable: true })
  patientNotes!: string | null;

  /** Priority level */
  @Column({ name: 'priority', type: 'varchar', length: 20, default: 'medium' })
  priority!: 'high' | 'medium' | 'low';

  /** Whether this task was AI-suggested */
  @Column({ name: 'is_ai_suggested', type: 'boolean', default: false })
  isAiSuggested!: boolean;

  /** Related goal ID if this task supports a specific goal */
  @Column({ name: 'goal_id', type: 'uuid', nullable: true })
  goalId!: string | null;

  /** Related encounter ID if this task originated from an encounter */
  @Column({ name: 'encounter_id', type: 'varchar', length: 100, nullable: true })
  encounterId!: string | null;

  /** General notes */
  @Column({ name: 'notes', type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
