import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';

export enum ScreeningResultStatus {
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  DISCONTINUED = 'discontinued',
}

export interface QuestionAnswer {
  questionId: string;
  questionText: string;
  answerValue: string;
  answerLabel?: string;
  score?: number;
  loincCode?: string;
  loincAnswerCode?: string;
}

export interface ScoreResult {
  totalScore: number | null;
  category?: string;
  severity?: 'minimal' | 'mild' | 'moderate' | 'moderately_severe' | 'severe' | 'low' | 'moderate' | 'high';
  interpretation?: string;
  recommendation?: string;
  color?: string;
}

export interface ScreeningAlert {
  severity: 'info' | 'warning' | 'critical';
  message: string;
  triggeredAt: string;
}

@Entity('screening_results')
export class ScreeningResult {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  @Index('IDX_screening_result_tenant')
  tenantId!: string;

  @Column({ name: 'instrument_id', type: 'uuid' })
  @Index('IDX_screening_result_instrument')
  instrumentId!: string;

  @Column({ name: 'instrument_code', type: 'varchar', length: 50 })
  instrumentCode!: string;

  @Column({ name: 'instrument_title', type: 'varchar', length: 255 })
  instrumentTitle!: string;

  @Column({ name: 'patient_id', type: 'varchar', length: 100 })
  @Index('IDX_screening_result_tenant_patient')
  patientId!: string;

  @Column({ name: 'patient_name', type: 'varchar', length: 200 })
  patientName!: string;

  @Column({ name: 'encounter_id', type: 'varchar', length: 100, nullable: true })
  encounterId!: string | null;

  @Column({ name: 'status', type: 'varchar', length: 20, default: ScreeningResultStatus.IN_PROGRESS })
  status!: ScreeningResultStatus;

  @Column({ name: 'answers', type: 'jsonb', default: [] })
  answers!: QuestionAnswer[];

  @Column({ name: 'score', type: 'jsonb', nullable: true })
  score!: ScoreResult | null;

  @Column({ name: 'alerts', type: 'jsonb', default: [] })
  alerts!: ScreeningAlert[];

  @Column({ name: 'administered_by', type: 'varchar', length: 50 })
  administeredBy!: 'patient_self' | 'staff_administered';

  @Column({ name: 'administered_by_user_id', type: 'varchar', length: 100, nullable: true })
  administeredByUserId!: string | null;

  @Column({ name: 'administered_by_name', type: 'varchar', length: 200, nullable: true })
  administeredByName!: string | null;

  @Column({ name: 'administration_context', type: 'varchar', length: 50, nullable: true })
  administrationContext!: 'pre_visit_portal' | 'in_visit_tablet' | 'in_visit_staff' | 'telehealth' | null;

  @Column({ name: 'started_at', type: 'timestamptz' })
  startedAt!: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  @Index('IDX_screening_result_completed')
  completedAt!: Date | null;

  @Column({ name: 'duration_seconds', type: 'int', nullable: true })
  durationSeconds!: number | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'fhir_observation_id', type: 'varchar', length: 100, nullable: true })
  fhirObservationId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
