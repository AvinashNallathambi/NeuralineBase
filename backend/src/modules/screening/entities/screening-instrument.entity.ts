import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';

export enum InstrumentCategory {
  DEPRESSION = 'depression',
  ANXIETY = 'anxiety',
  SUBSTANCE_USE = 'substance_use',
  SUICIDE_RISK = 'suicide_risk',
  SDOH = 'sdoh',
  BIPOLAR = 'bipolar',
  ADHD = 'adhd',
  COGNITIVE = 'cognitive',
  TRAUMA = 'trauma',
  SLEEP = 'sleep',
  PAIN = 'pain',
  PEDIATRIC = 'pediatric',
  PERINATAL = 'perinatal',
  CUSTOM = 'custom',
}

export enum QuestionType {
  CHOICE = 'choice',
  MULTI_SELECT = 'multi_select',
  TEXT = 'text',
  NUMBER = 'number',
  LIKERT = 'likert',
  DISPLAY = 'display',
}

export interface InstrumentQuestion {
  id: string; // LOINC code or internal ID
  text: string;
  type: QuestionType;
  loincCode?: string;
  helpText?: string;
  options?: Array<{
    value: string;
    label: string;
    score: number;
    loincAnswerCode?: string;
  }>;
  required: boolean;
}

export interface ScoringRule {
  type: 'sum' | 'categorical' | 'custom';
  // For 'sum': sum all question scores
  // For 'categorical': map score ranges to categories
  // For 'custom': custom scoring function name
  ranges?: Array<{
    min: number;
    max: number;
    label: string;
    severity: 'minimal' | 'mild' | 'moderate' | 'moderately_severe' | 'severe';
    color: string;
    recommendation?: string;
  }>;
  // For categorical scoring (e.g., C-SSRS)
  categories?: Array<{
    label: string;
    condition: string; // description of when this category applies
    severity: 'low' | 'moderate' | 'high';
    recommendation: string;
  }>;
}

export interface AdministrationRule {
  // Who should administer
  mode: 'patient_self' | 'staff_administered' | 'either';
  // When to administer
  frequency: 'annual' | 'per_visit' | 'every_n_days' | 'on_trigger' | 'one_time';
  // Age range
  minAge?: number;
  maxAge?: number;
  // Sex restriction
  sex?: 'M' | 'F' | 'any';
  // Trigger conditions
  triggers?: string[];
  // Alert thresholds
  alertThresholds?: Array<{
    condition: string;
    severity: 'info' | 'warning' | 'critical';
    message: string;
  }>;
}

@Entity('screening_instruments')
export class ScreeningInstrument {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  @Index('IDX_screening_instrument_tenant')
  tenantId!: string;

  @Column({ name: 'code', type: 'varchar', length: 50 })
  @Index('IDX_screening_instrument_code')
  code!: string; // e.g., 'PHQ-9', 'GAD-7', 'AUDIT-C'

  @Column({ name: 'title', type: 'varchar', length: 255 })
  title!: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'category', type: 'varchar', length: 30 })
  category!: InstrumentCategory;

  @Column({ name: 'is_predefined', type: 'boolean', default: false })
  isPredefined!: boolean;

  @Column({ name: 'is_locked', type: 'boolean', default: false })
  isLocked!: boolean; // Predefined instruments are locked (cannot edit questions/scoring)

  @Column({ name: 'loinc_code', type: 'varchar', length: 20, nullable: true })
  loincCode!: string | null;

  @Column({ name: 'version', type: 'varchar', length: 20, default: '1.0' })
  version!: string;

  @Column({ name: 'questions', type: 'jsonb', default: [] })
  questions!: InstrumentQuestion[];

  @Column({ name: 'scoring_rules', type: 'jsonb', nullable: true })
  scoringRules!: ScoringRule | null;

  @Column({ name: 'administration_rules', type: 'jsonb', nullable: true })
  administrationRules!: AdministrationRule | null;

  @Column({ name: 'estimated_minutes', type: 'int', default: 5 })
  estimatedMinutes!: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'created_by', type: 'varchar', length: 100, nullable: true })
  createdBy!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
