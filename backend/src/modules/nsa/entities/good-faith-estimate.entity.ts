import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';
import { DecimalTransformer } from '../../../common/transformers/decimal.transformer';

export enum GfeType {
  INSURED_OON = 'insured_oon',
  SELF_PAY = 'self_pay',
  UNINSURED = 'uninsured',
}

export enum GfeStatus {
  DRAFT = 'draft',
  DELIVERED = 'delivered',
  ACKNOWLEDGED = 'acknowledged',
  DISPUTED = 'disputed',
  EXPIRED = 'expired',
  SUPERSEDED = 'superseded',
}

export enum DeliveryMethod {
  PORTAL = 'portal',
  EMAIL = 'email',
  MAIL = 'mail',
  IN_PERSON = 'in_person',
  VERBAL_WITNESS = 'verbal_witness',
}

export enum VarianceStatus {
  NONE = 'none',
  UNDER_THRESHOLD = 'under_threshold',
  OVER_THRESHOLD = 'over_threshold',
  DISPUTED = 'disputed',
  RESOLVED = 'resolved',
}

export interface GfeItem {
  service: string;
  cptCode: string;
  charge: number;
  insuranceEstimate: number;
  patientEstimate: number;
}

export interface AiAccuracyFlags {
  highRisk: boolean;
  riskFactors: string[];
  recommendedActions: string[];
}

export interface ReconciliationData {
  reconciledAt: string;
  finalBilledAmount: number;
  finalPaidAmount: number;
  perItemVariance: Array<{
    cptCode: string;
    estimated: number;
    actual: number;
    variance: number;
  }>;
  accuracyScore: number;
}

@Entity('good_faith_estimates')
@Index(['tenantId', 'patientId'])
@Index(['tenantId', 'patientId', 'status'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'superbillId'])
export class GoodFaithEstimate {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'patient_id', type: 'varchar', length: 100 })
  patientId!: string;

  @Column({ name: 'patient_name', type: 'varchar', length: 200 })
  patientName!: string;

  @Column({ name: 'superbill_id', type: 'varchar', length: 100, nullable: true })
  superbillId!: string | null;

  @Column({ name: 'encounter_id', type: 'varchar', length: 100, nullable: true })
  encounterId!: string | null;

  @Column({ name: 'provider_id', type: 'varchar', length: 100, nullable: true })
  providerId!: string | null;

  @Column({ name: 'provider_name', type: 'varchar', length: 200, nullable: true })
  providerName!: string | null;

  @Column({ name: 'gfe_type', type: 'varchar', length: 20 })
  gfeType!: GfeType;

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'draft' })
  status!: GfeStatus;

  @Column({ name: 'version', type: 'int', default: 1 })
  version!: number;

  @Column({ name: 'service_date', type: 'date' })
  serviceDate!: Date;

  @Column({ name: 'scheduled_date', type: 'timestamptz', nullable: true })
  scheduledDate!: Date | null;

  @Column({
    name: 'total_charge',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: DecimalTransformer,
  })
  totalCharge!: number;

  @Column({
    name: 'insurance_estimate',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: DecimalTransformer,
  })
  insuranceEstimate!: number;

  @Column({
    name: 'patient_estimate',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: DecimalTransformer,
  })
  patientEstimate!: number;

  @Column({ name: 'items', type: 'jsonb', default: [] })
  items!: GfeItem[];

  @Column({ name: 'disclaimers', type: 'jsonb', default: [] })
  disclaimers!: string[];

  @Column({ name: 'compliance_notes', type: 'jsonb', default: [] })
  complianceNotes!: string[];

  @Column({ name: 'delivery_method', type: 'varchar', length: 20, nullable: true })
  deliveryMethod!: DeliveryMethod | null;

  @Column({ name: 'delivered_at', type: 'timestamptz', nullable: true })
  deliveredAt!: Date | null;

  @Column({ name: 'delivered_by', type: 'varchar', length: 100, nullable: true })
  deliveredBy!: string | null;

  @Column({ name: 'acknowledged_at', type: 'timestamptz', nullable: true })
  acknowledgedAt!: Date | null;

  @Column({ name: 'acknowledged_by', type: 'varchar', length: 200, nullable: true })
  acknowledgedBy!: string | null;

  @Column({ name: 'delivery_deadline', type: 'timestamptz', nullable: true })
  deliveryDeadline!: Date | null;

  @Column({ name: 'is_compliant', type: 'boolean', default: false })
  isCompliant!: boolean;

  @Column({
    name: 'variance_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: DecimalTransformer,
  })
  varianceAmount!: number;

  @Column({ name: 'variance_status', type: 'varchar', length: 20, default: 'none' })
  varianceStatus!: VarianceStatus;

  // P1: AI Estimate Accuracy Predictor
  @Column({ name: 'ai_accuracy_score', type: 'float', nullable: true })
  aiAccuracyScore!: number | null;

  @Column({ name: 'ai_accuracy_flags', type: 'jsonb', nullable: true })
  aiAccuracyFlags!: AiAccuracyFlags | null;

  // P1: AI Patient-Friendly GFE Explainer
  @Column({ name: 'patient_friendly_explanation', type: 'text', nullable: true })
  patientFriendlyExplanation!: string | null;

  // P1: AI Diagnosis-Code Completion
  @Column({ name: 'predicted_diagnosis_codes', type: 'jsonb', nullable: true })
  predictedDiagnosisCodes!: Array<{ code: string; description: string; confidence: number }> | null;

  // P1: GFE-to-Claim Reconciliation Loop
  @Column({ name: 'reconciliation_data', type: 'jsonb', nullable: true })
  reconciliationData!: ReconciliationData | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
