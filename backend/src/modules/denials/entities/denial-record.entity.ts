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
import { DecimalTransformer } from '../../../common/transformers/decimal.transformer';

export enum DenialRootCause {
  ELIGIBILITY = 'eligibility',
  PRIOR_AUTHORIZATION = 'prior_authorization',
  MEDICAL_NECESSITY = 'medical_necessity',
  CODING_ERROR = 'coding_error',
  MISSING_INFORMATION = 'missing_information',
  DUPLICATE = 'duplicate',
  TIMELY_FILING = 'timely_filing',
  COORDINATION_OF_BENEFITS = 'coordination_of_benefits',
  NON_COVERED_SERVICE = 'non_covered_service',
  BUNDLING = 'bundling',
  FEE_SCHEDULE = 'fee_schedule',
  BENEFIT_MAXIMUM = 'benefit_maximum',
  FREQUENCY_LIMIT = 'frequency_limit',
  WRONG_PAYER = 'wrong_payer',
  PATIENT_RESPONSIBILITY = 'patient_responsibility',
  OTHER = 'other',
}

export enum DenialPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum DenialWorklistStatus {
  NEW = 'new',
  IN_PROGRESS = 'in_progress',
  APPEALED = 'appealed',
  RESOLVED = 'resolved',
  WRITTEN_OFF = 'written_off',
  ESCALATED = 'escalated',
}

@Entity('denial_records')
@Index(['tenantId', 'claimId'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'rootCauseCategory'])
@Index(['tenantId', 'payerName'])
@Index(['tenantId', 'priority'])
export class DenialRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  @Index()
  tenantId!: string;

  // Link to claim
  @Column({ name: 'claim_id', type: 'uuid', nullable: true })
  @Index()
  claimId!: string | null;

  @Column({ name: 'claim_number', type: 'varchar', length: 50, nullable: true })
  claimNumber!: string | null;

  // Link to remittance claim
  @Column({ name: 'remittance_claim_id', type: 'uuid', nullable: true })
  remittanceClaimId!: string | null;

  // Link to adjustment that triggered the denial
  @Column({ name: 'adjustment_id', type: 'uuid', nullable: true })
  adjustmentId!: string | null;

  // Patient info
  @Column({ name: 'patient_id', type: 'uuid', nullable: true })
  patientId!: string | null;

  @Column({ name: 'patient_name', type: 'varchar', length: 255, nullable: true })
  patientName!: string | null;

  // Payer info
  @Column({ name: 'payer_name', type: 'varchar', length: 255, nullable: true })
  payerName!: string | null;

  @Column({ name: 'payer_id', type: 'uuid', nullable: true })
  payerId!: string | null;

  // Denial codes
  @Column({ name: 'carc_code', type: 'varchar', length: 10 })
  carcCode!: string;

  @Column({ name: 'carc_description', type: 'text', nullable: true })
  carcDescription!: string | null;

  @Column({ name: 'rarc_code', type: 'varchar', length: 10, nullable: true })
  rarcCode!: string | null;

  @Column({ name: 'rarc_description', type: 'text', nullable: true })
  rarcDescription!: string | null;

  @Column({ name: 'group_code', type: 'varchar', length: 5, nullable: true })
  groupCode!: string | null;

  // Categorized root cause
  @Column({ name: 'root_cause_category', type: 'enum', enum: DenialRootCause, default: DenialRootCause.OTHER })
  rootCauseCategory!: DenialRootCause;

  // Financial
  @Column({ name: 'denied_amount', type: 'decimal', precision: 12, scale: 2, default: 0, transformer: DecimalTransformer })
  deniedAmount!: number;

  @Column({ name: 'billed_amount', type: 'decimal', precision: 12, scale: 2, default: 0, transformer: DecimalTransformer })
  billedAmount!: number;

  @Column({ name: 'paid_amount', type: 'decimal', precision: 12, scale: 2, default: 0, transformer: DecimalTransformer })
  paidAmount!: number;

  // Dates
  @Column({ name: 'denial_date', type: 'date', nullable: true })
  denialDate!: Date | null;

  @Column({ name: 'service_date', type: 'date', nullable: true })
  serviceDate!: Date | null;

  @Column({ name: 'filing_deadline', type: 'date', nullable: true })
  filingDeadline!: Date | null; // Appeal deadline

  // Worklist management
  @Column({ type: 'enum', enum: DenialPriority, default: DenialPriority.MEDIUM })
  priority!: DenialPriority;

  @Column({ type: 'enum', enum: DenialWorklistStatus, default: DenialWorklistStatus.NEW })
  status!: DenialWorklistStatus;

  @Column({ name: 'assigned_to', type: 'uuid', nullable: true })
  assignedTo!: string | null;

  @Column({ name: 'assigned_name', type: 'varchar', length: 255, nullable: true })
  assignedName!: string | null;

  // Recovery prediction (AI)
  @Column({ name: 'recovery_probability', type: 'decimal', precision: 5, scale: 2, nullable: true, transformer: DecimalTransformer })
  recoveryProbability!: number | null; // 0-100

  @Column({ name: 'estimated_recovery', type: 'decimal', precision: 12, scale: 2, nullable: true, transformer: DecimalTransformer })
  estimatedRecovery!: number | null;

  // Service line info
  @Column({ name: 'cpt_code', type: 'varchar', length: 10, nullable: true })
  cptCode!: string | null;

  @Column({ name: 'service_line_id', type: 'uuid', nullable: true })
  serviceLineId!: string | null;

  // Notes and metadata
  @Column({ name: 'denial_reason_text', type: 'text', nullable: true })
  denialReasonText!: string | null;

  @Column({ name: 'resolution_notes', type: 'text', nullable: true })
  resolutionNotes!: string | null;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt!: Date | null;

  @Column({ name: 'metadata', type: 'jsonb', default: {} })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
