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
  OneToMany,
} from 'typeorm';
import { DecimalTransformer } from '../../../common/transformers/decimal.transformer';

export enum ClaimStatus {
  DRAFT = 'draft',
  READY_TO_BILL = 'ready_to_bill',
  SUBMITTED = 'submitted',
  PAID = 'paid',
  DENIED = 'denied',
  PARTIALLY_PAID = 'partially_paid',
  APPEALED = 'appealed',
  CANCELLED = 'cancelled',
}

@Entity('encounter_claims')
@Index(['tenantId', 'claimNumber', 'patientId'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'encounterId'])
export class EncounterClaim {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  @Index()
  tenantId!: string;

  @Column({ name: 'claim_number', type: 'varchar', length: 50, unique: true })
  claimNumber!: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  @Index()
  patientId!: string;

  @Column({ name: 'patient_name', type: 'varchar', length: 255 })
  patientName!: string;

  @Column({ name: 'encounter_id', type: 'uuid', nullable: true })
  encounterId!: string | null;

  @Column({ name: 'provider_id', type: 'varchar', length: 100 })
  providerId!: string;

  @Column({ name: 'provider_name', type: 'varchar', length: 255 })
  providerName!: string;

  @Column({ name: 'provider_npi', type: 'varchar', length: 20 })
  providerNPI!: string;

  @Column({ name: 'insurance_payer_id', type: 'uuid', nullable: true })
  insurancePayerId!: string | null;

  @Column({ name: 'insurance_payer_name', type: 'varchar', length: 255, nullable: true })
  insurancePayerName!: string | null;

  @Column({ name: 'policy_number', type: 'varchar', length: 50, nullable: true })
  policyNumber!: string | null;

  @Column({ name: 'group_number', type: 'varchar', length: 50, nullable: true })
  groupNumber!: string | null;

  @Column({ name: 'service_date', type: 'date' })
  serviceDate!: Date;

  @Column({ name: 'submission_date', type: 'date', nullable: true })
  submissionDate!: Date | null;

  @Column({
    type: 'enum',
    enum: ClaimStatus,
    default: ClaimStatus.DRAFT,
  })
  status!: ClaimStatus;

  @Column({ name: 'total_billed', type: 'decimal', precision: 10, scale: 2, default: 0, transformer: DecimalTransformer })
  totalBilled!: number;

  @Column({ name: 'total_allowed', type: 'decimal', precision: 10, scale: 2, nullable: true, transformer: DecimalTransformer })
  totalAllowed!: number | null;

  @Column({ name: 'total_paid', type: 'decimal', precision: 10, scale: 2, default: 0, transformer: DecimalTransformer })
  totalPaid!: number;

  @Column({ name: 'patient_responsibility', type: 'decimal', precision: 10, scale: 2, default: 0, transformer: DecimalTransformer })
  patientResponsibility!: number;

  @Column({ name: 'deductible_applied', type: 'decimal', precision: 10, scale: 2, default: 0, transformer: DecimalTransformer })
  deductibleApplied!: number;

  @Column({ name: 'copay_applied', type: 'decimal', precision: 10, scale: 2, default: 0, transformer: DecimalTransformer })
  copayApplied!: number;

  @Column({ name: 'coinsurance_applied', type: 'decimal', precision: 10, scale: 2, default: 0, transformer: DecimalTransformer })
  coinsuranceApplied!: number;

  @Column({ name: 'adjustment_amount', type: 'decimal', precision: 10, scale: 2, default: 0, transformer: DecimalTransformer })
  adjustmentAmount!: number;

  @Column({ name: 'denial_reason', type: 'text', nullable: true })
  denialReason!: string | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'metadata', type: 'jsonb', default: {} })
  metadata!: Record<string, unknown>;

  @OneToMany('ClaimLineItem', 'claim', {
    cascade: true,
    eager: true,
  })
  lineItems!: unknown[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
