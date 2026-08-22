import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';

export type GoalStatus = 'active' | 'achieved' | 'not_achieved' | 'suspended' | 'cancelled';
export type GoalPriority = 'high' | 'medium' | 'low';

@Entity('care_plan_goals')
@Index(['tenantId', 'carePlanId'])
@Index(['tenantId', 'patientId'])
@Index(['tenantId', 'patientId', 'status'])
export class CarePlanGoal {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'care_plan_id', type: 'uuid' })
  carePlanId!: string;

  @Column({ name: 'patient_id', type: 'varchar', length: 100 })
  patientId!: string;

  /** Goal description (e.g. "Reduce HbA1c to below 7.0%") */
  @Column({ name: 'description', type: 'text' })
  description!: string;

  /** Measurable target (e.g. "7.0") */
  @Column({ name: 'target_value', type: 'varchar', length: 100, nullable: true })
  targetValue!: string | null;

  /** Unit of measurement (e.g. "%", "mmHg", "mg/dL") */
  @Column({ name: 'target_unit', type: 'varchar', length: 50, nullable: true })
  targetUnit!: string | null;

  /** Current value (updated as data comes in) */
  @Column({ name: 'current_value', type: 'varchar', length: 100, nullable: true })
  currentValue!: string | null;

  /** When the current value was last measured */
  @Column({ name: 'last_measured_at', type: 'timestamptz', nullable: true })
  lastMeasuredAt!: Date | null;

  /** LOINC code or lab test name this goal tracks */
  @Column({ name: 'metric_name', type: 'varchar', length: 100, nullable: true })
  metricName!: string | null;

  /** Direction: is the goal to decrease or increase the metric? */
  @Column({ name: 'target_direction', type: 'varchar', length: 20, nullable: true })
  targetDirection!: 'decrease' | 'increase' | 'maintain' | null;

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'active' })
  status!: GoalStatus;

  @Column({ name: 'priority', type: 'varchar', length: 20, default: 'medium' })
  priority!: GoalPriority;

  /** Target date to achieve this goal */
  @Column({ name: 'target_date', type: 'date', nullable: true })
  targetDate!: Date | null;

  /** Start date for working toward this goal */
  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate!: Date | null;

  /** Date the goal was achieved (if status = 'achieved') */
  @Column({ name: 'achieved_date', type: 'date', nullable: true })
  achievedDate!: Date | null;

  /** Notes / progress comments */
  @Column({ name: 'notes', type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
