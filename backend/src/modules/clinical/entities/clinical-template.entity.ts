import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';

export enum ClinicalTemplateStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ARCHIVED = 'archived',
  DRAFT = 'draft',
}

export interface ClinicalTemplateSoap {
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
}

export interface ClinicalTemplateVitals {
  bloodPressure?: string;
  heartRate?: string;
  temperature?: string;
  temperatureRoute?: string;
  weight?: string;
  weightUnit?: string;
  height?: string;
  heightUnit?: string;
  bmi?: string;
  oxygenSaturation?: string;
  respiratoryRate?: string;
  painScore?: number;
  painLocation?: string;
  bloodGlucose?: string;
  bloodGlucoseContext?: string;
}

export interface ClinicalTemplateDiagnosis {
  code: string;
  description: string;
  isPrimary: boolean;
  type?: 'chronic' | 'acute' | 'rule_out';
  status?: 'active' | 'resolved' | 'ruled_out';
  notes?: string;
}

export interface ClinicalTemplateMedication {
  name: string;
  dosage: string;
  frequency: string;
  route?: string;
  duration?: string;
  refills?: number;
  instructions?: string;
}

export interface ClinicalTemplateProcedure {
  name: string;
  cptCode?: string;
  description: string;
}

export interface ClinicalTemplateOrderLab {
  name: string;
  loincCode?: string;
  priority?: 'routine' | 'stat' | 'asap';
  notes?: string;
}

export interface ClinicalTemplateOrderImaging {
  name: string;
  modality?: string;
  bodyPart?: string;
  priority?: 'routine' | 'stat' | 'asap';
}

export interface ClinicalTemplateOrderReferral {
  specialty: string;
  provider?: string;
  reason: string;
  urgency?: 'routine' | 'urgent' | 'emergent';
}

export interface ClinicalTemplateOrders {
  labs?: ClinicalTemplateOrderLab[];
  imaging?: ClinicalTemplateOrderImaging[];
  referrals?: ClinicalTemplateOrderReferral[];
  procedures?: ClinicalTemplateProcedure[];
}

export interface ClinicalTemplateTreatmentPlan {
  medications?: ClinicalTemplateMedication[];
  procedures?: ClinicalTemplateProcedure[];
  followUp?: string;
  followUpDate?: string;
  followUpProviderName?: string;
  referrals?: Array<{ specialty: string; provider?: string; reason: string; urgency?: string }>;
  goals?: string[];
  interventions?: string[];
  homeInstructions?: string;
  patientEducation?: string[];
  restrictions?: string;
  recallReminder?: string;
}

export interface ClinicalTemplateBillingCode {
  codeType: 'CPT' | 'ICD10' | 'HCPCS' | 'SNOMED';
  code: string;
  description: string;
  isPrimary?: boolean;
}

@Entity('clinical_templates')
@Index(['tenantId', 'specialty'])
@Index(['tenantId', 'visitType'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'isDefault'])
@Index(['tenantId', 'isFavorite'])
export class ClinicalTemplate {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  @Index()
  tenantId!: string;

  @Column({ length: 255 })
  name!: string;

  @Column({ name: 'specialty', length: 100 })
  specialty!: string;

  @Column({ name: 'visit_type', length: 100 })
  visitType!: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ length: 100, default: 'FileTextOutlined' })
  icon!: string;

  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault!: boolean;

  @Column({ name: 'is_favorite', type: 'boolean', default: false })
  isFavorite!: boolean;

  @Column({ name: 'usage_count', type: 'int', default: 0 })
  usageCount!: number;

  @Column({
    type: 'enum',
    enum: ClinicalTemplateStatus,
    default: ClinicalTemplateStatus.ACTIVE,
  })
  status!: ClinicalTemplateStatus;

  @Column({ name: 'encounter_type', type: 'varchar', length: 50, nullable: true })
  encounterType?: string | null;

  @Column({ name: 'department', type: 'varchar', length: 100, nullable: true })
  department?: string | null;

  @Column({ name: 'tags', type: 'simple-array', nullable: true })
  tags?: string[];

  @Column({ name: 'visit_reason', type: 'text', nullable: true })
  visitReason?: string;

  @Column({ name: 'chief_complaint', type: 'text', nullable: true })
  chiefComplaint?: string;

  @Column({ name: 'soap_template', type: 'jsonb', default: {} })
  soapTemplate!: ClinicalTemplateSoap;

  @Column({ name: 'vitals_template', type: 'jsonb', default: {} })
  vitalsTemplate!: ClinicalTemplateVitals;

  @Column({ name: 'diagnosis_template', type: 'jsonb', default: [] })
  diagnosisTemplate!: ClinicalTemplateDiagnosis[];

  @Column({ name: 'medication_template', type: 'jsonb', default: [] })
  medicationTemplate!: ClinicalTemplateMedication[];

  @Column({ name: 'orders_template', type: 'jsonb', default: {} })
  ordersTemplate!: ClinicalTemplateOrders;

  @Column({ name: 'treatment_plan_template', type: 'jsonb', default: {} })
  treatmentPlanTemplate!: ClinicalTemplateTreatmentPlan;

  @Column({ name: 'patient_instructions', type: 'text', nullable: true })
  patientInstructions?: string;

  @Column({ name: 'billing_codes', type: 'jsonb', default: [] })
  billingCodes!: ClinicalTemplateBillingCode[];

  @Column({ name: 'provider_notes', type: 'text', nullable: true })
  providerNotes?: string;

  @Column({ name: 'created_by', type: 'varchar', length: 255, nullable: true })
  createdBy?: string | null;

  @Column({ name: 'created_by_name', type: 'varchar', length: 255, nullable: true })
  createdByName?: string | null;

  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true })
  lastUsedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
