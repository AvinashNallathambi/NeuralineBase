import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Patient } from '../../patients/entities/patient.entity';

/**
 * Persisted quality measure result for a patient.
 * One row per patient × measure × reporting period.
 */
@Entity('quality_measure_results')
@Index(['tenantId', 'patientId'])
@Index(['tenantId', 'patientId', 'measureId'])
@Index(['tenantId', 'measureId', 'status'])
export class QualityMeasureResult {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId!: string;

  /** e.g. 'CMS122v13', 'MIPS-001', 'HEDIS-CDC' */
  @Column({ name: 'measure_id', type: 'varchar', length: 64 })
  measureId!: string;

  /** e.g. 'Diabetes: HbA1c Testing' */
  @Column({ name: 'measure_title', type: 'varchar', length: 255 })
  measureTitle!: string;

  /** e.g. 'MIPS', 'eCQM', 'HEDIS', 'UDS' */
  @Column({ name: 'program', type: 'varchar', length: 32 })
  program!: string;

  /** e.g. 'preventive', 'chronic_care', 'medication_safety' */
  @Column({ name: 'category', type: 'varchar', length: 64 })
  category!: string;

  /** 'met' | 'not_met' | 'overdue' | 'not_applicable' */
  @Column({ name: 'status', type: 'varchar', length: 20 })
  status!: string;

  /** Reporting period start (e.g. 2025-01-01) */
  @Column({ name: 'period_start', type: 'date' })
  periodStart!: Date;

  /** Reporting period end (e.g. 2025-12-31) */
  @Column({ name: 'period_end', type: 'date' })
  periodEnd!: Date;

  /** Last value observed (e.g. '7.2%', '140/90', 'Completed') */
  @Column({ name: 'last_value', type: 'varchar', length: 255, nullable: true })
  lastValue!: string | null;

  /** Target value (e.g. '<8%', '<140/90', 'Annually') */
  @Column({ name: 'target_value', type: 'varchar', length: 255, nullable: true })
  targetValue!: string | null;

  /** Date the last qualifying event occurred */
  @Column({ name: 'last_event_date', type: 'date', nullable: true })
  lastEventDate!: Date | null;

  /** AI-generated explanation of why the measure is met/not_met */
  @Column({ name: 'explanation', type: 'text', nullable: true })
  explanation!: string | null;

  /** AI-generated recommendation to close the gap */
  @Column({ name: 'recommendation', type: 'text', nullable: true })
  recommendation!: string | null;

  /** Whether this gap can be closed during a routine visit */
  @Column({ name: 'closeable_in_visit', type: 'boolean', default: false })
  closeableInVisit!: boolean;

  /** Suggested action to close the gap */
  @Column({ name: 'suggested_action', type: 'varchar', length: 512, nullable: true })
  suggestedAction!: string | null;

  /** Priority 1-5 (1 = highest) based on clinical impact + quality score impact */
  @Column({ name: 'priority', type: 'int', default: 3 })
  priority!: number;

  /** Cross-program mappings (which other programs this measure satisfies) */
  @Column({ name: 'cross_program_mappings', type: 'jsonb', default: [] })
  crossProgramMappings!: Array<{ program: string; measureId: string; measureTitle: string }>;

  /** Data elements that drove this result (for explainability) */
  @Column({ name: 'data_elements', type: 'jsonb', default: [] })
  dataElements!: Array<{ source: string; field: string; value: string; date?: string }>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient;
}
