import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { PatientInsurance } from '../../billing/entities/patient-insurance.entity';

export enum VerificationStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  FAILED = 'failed',
  ERROR = 'error',
}

export enum VerificationType {
  REALTIME = 'real-time',
  BATCH = 'batch',
  SCHEDULED = 'scheduled',
  MANUAL = 'manual',
}

export enum CoverageStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  TERMINATED = 'terminated',
  UNKNOWN = 'unknown',
}

@Entity('insurance_verifications')
@Index(['tenantId', 'patientId'])
@Index(['tenantId', 'patientInsuranceId'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'verifiedAt'])
export class InsuranceVerification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  @Index()
  tenantId!: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  @Index()
  patientId!: string;

  @Column({ name: 'appointment_id', type: 'uuid', nullable: true })
  appointmentId!: string | null;

  @Column({ name: 'patient_insurance_id', type: 'uuid', nullable: true })
  patientInsuranceId!: string | null;

  @Column({ name: 'insurance_payer_id', type: 'uuid', nullable: true })
  insurancePayerId!: string | null;

  @Column({
    type: 'enum',
    enum: VerificationStatus,
    default: VerificationStatus.PENDING,
  })
  status!: VerificationStatus;

  @Column({
    type: 'enum',
    enum: VerificationType,
    default: VerificationType.REALTIME,
  })
  verificationType!: VerificationType;

  @Column({
    type: 'enum',
    enum: CoverageStatus,
    default: CoverageStatus.UNKNOWN,
  })
  coverageStatus!: CoverageStatus;

  @Column({ name: 'service_type', type: 'varchar', length: 50, nullable: true })
  serviceType!: string | null;

  @Column({ name: 'effective_date', type: 'date', nullable: true })
  effectiveDate!: Date | null;

  @Column({ name: 'expiration_date', type: 'date', nullable: true })
  expirationDate!: Date | null;

  @Column({ name: 'deductible_individual', type: 'decimal', precision: 10, scale: 2, nullable: true })
  deductibleIndividual!: number | null;

  @Column({ name: 'deductible_family', type: 'decimal', precision: 10, scale: 2, nullable: true })
  deductibleFamily!: number | null;

  @Column({ name: 'deductible_remaining', type: 'decimal', precision: 10, scale: 2, nullable: true })
  deductibleRemaining!: number | null;

  @Column({ name: 'out_of_pocket_individual', type: 'decimal', precision: 10, scale: 2, nullable: true })
  outOfPocketIndividual!: number | null;

  @Column({ name: 'out_of_pocket_family', type: 'decimal', precision: 10, scale: 2, nullable: true })
  outOfPocketFamily!: number | null;

  @Column({ name: 'out_of_pocket_remaining', type: 'decimal', precision: 10, scale: 2, nullable: true })
  outOfPocketRemaining!: number | null;

  @Column({ name: 'copay_amount', type: 'decimal', precision: 10, scale: 2, nullable: true })
  copayAmount!: number | null;

  @Column({ name: 'coinsurance_percentage', type: 'decimal', precision: 5, scale: 2, nullable: true })
  coinsurancePercentage!: number | null;

  @Column({ name: 'authorization_required', type: 'boolean', default: false })
  authorizationRequired!: boolean;

  @Column({ name: 'referral_required', type: 'boolean', default: false })
  referralRequired!: boolean;

  @Column({ name: 'benefit_limitations', type: 'jsonb', nullable: true })
  benefitLimitations!: Record<string, unknown> | null;

  @Column({ name: 'request_payload', type: 'jsonb', nullable: true })
  requestPayload!: Record<string, unknown> | null;

  @Column({ name: 'response_payload', type: 'jsonb', nullable: true })
  responsePayload!: Record<string, unknown> | null;

  @Column({ name: 'error_details', type: 'jsonb', nullable: true })
  errorDetails!: Record<string, unknown> | null;

  @Column({ name: 'verified_at', type: 'timestamptz', nullable: true })
  verifiedAt!: Date | null;

  @Column({ name: 'verified_by', type: 'varchar', length: 64, nullable: true })
  verifiedBy!: string | null;

  @Column({ name: 'verified_by_name', type: 'varchar', length: 100, nullable: true })
  verifiedByName!: string | null;

  @Column({ name: 'provider_name', type: 'varchar', length: 100, nullable: true })
  providerName!: string | null;

  @Column({ name: 'payer_name', type: 'varchar', length: 100, nullable: true })
  payerName!: string | null;

  @Column({ name: 'policy_number', type: 'varchar', length: 50, nullable: true })
  policyNumber!: string | null;

  @Column({ name: 'group_number', type: 'varchar', length: 50, nullable: true })
  groupNumber!: string | null;

  @Column({ name: 'plan_name', type: 'varchar', length: 150, nullable: true })
  planName!: string | null;

  @Column({ name: 'plan_type', type: 'varchar', length: 50, nullable: true })
  planType!: string | null;

  @Column({ name: 'network', type: 'varchar', length: 100, nullable: true })
  network!: string | null;

  @Column({ name: 'subscriber_name', type: 'varchar', length: 150, nullable: true })
  subscriberName!: string | null;

  @Column({ name: 'subscriber_relation', type: 'varchar', length: 50, nullable: true })
  subscriberRelation!: string | null;

  @Column({ name: 'patient_name', type: 'varchar', length: 150, nullable: true })
  patientName!: string | null;

  @Column({ name: 'benefits', type: 'jsonb', nullable: true })
  benefits!: Record<string, unknown>[] | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'metadata', type: 'jsonb', default: {} })
  metadata!: Record<string, unknown>;

  @ManyToOne(() => PatientInsurance, (insurance) => insurance.id, {
    nullable: true,
  })
  @JoinColumn({ name: 'patient_insurance_id' })
  patientInsurance!: PatientInsurance | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
