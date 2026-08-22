import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';

export type CarePlanStatus = 'active' | 'completed' | 'suspended' | 'cancelled';
export type CarePlanIntent = 'plan' | 'order' | 'proposal';

export interface CareTeamMemberData {
  id: string;
  providerId?: string;
  name: string;
  role: string; // 'physician' | 'nurse' | 'pharmacist' | 'care_coordinator' | 'patient' | 'caregiver'
  isActive: boolean;
  joinedAt: string;
}

export interface HealthConcernData {
  id: string;
  condition?: string; // diagnosis/condition name
  code?: string;
  codeSystem?: string; // 'ICD-10-CM' | 'ICD-9-CM' | 'SNOMED CT' | 'ICD-11' | 'CPT' | 'HCPCS' | 'LOINC' | 'CUSTOM'
  /** @deprecated Use `code` instead. Kept for backward compatibility. */
  icd10Code?: string;
  description: string;
  severity?: 'low' | 'moderate' | 'high' | 'critical';
}

@Entity('care_plans')
@Index(['tenantId', 'patientId'])
@Index(['tenantId', 'patientId', 'status'])
@Index(['tenantId', 'status'])
export class CarePlan {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'patient_id', type: 'varchar', length: 100 })
  patientId!: string;

  @Column({ name: 'patient_name', type: 'varchar', length: 200 })
  patientName!: string;

  @Column({ name: 'title', type: 'varchar', length: 255 })
  title!: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'active' })
  status!: CarePlanStatus;

  @Column({ name: 'intent', type: 'varchar', length: 20, default: 'plan' })
  intent!: CarePlanIntent;

  /** Category: 'chronic_care' | 'post_discharge' | 'preventive' | 'palliative' | 'behavioral' */
  @Column({ name: 'category', type: 'varchar', length: 50, default: 'chronic_care' })
  category!: string;

  /** Conditions/diagnoses this care plan addresses */
  @Column({ name: 'addresses', type: 'jsonb', default: [] })
  addresses!: HealthConcernData[];

  /** Care team members assigned to this plan */
  @Column({ name: 'care_team', type: 'jsonb', default: [] })
  careTeam!: CareTeamMemberData[];

  /** Originating encounter if created from one */
  @Column({ name: 'encounter_id', type: 'varchar', length: 100, nullable: true })
  encounterId!: string | null;

  /** Provider who created/owns this plan */
  @Column({ name: 'provider_id', type: 'varchar', length: 100, nullable: true })
  providerId!: string | null;

  @Column({ name: 'provider_name', type: 'varchar', length: 200, nullable: true })
  providerName!: string | null;

  /** Plan period */
  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate!: Date | null;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate!: Date | null;

  /** Whether this plan was AI-generated */
  @Column({ name: 'is_ai_generated', type: 'boolean', default: false })
  isAiGenerated!: boolean;

  /** Whether the plan has been reviewed/approved by a provider */
  @Column({ name: 'is_approved', type: 'boolean', default: false })
  isApproved!: boolean;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt!: Date | null;

  @Column({ name: 'approved_by', type: 'varchar', length: 100, nullable: true })
  approvedBy!: string | null;

  /** Patient education content associated with this plan */
  @Column({ name: 'patient_education', type: 'jsonb', default: [] })
  patientEducation!: Array<{ title: string; content: string; url?: string }>;

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
