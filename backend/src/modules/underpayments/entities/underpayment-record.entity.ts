import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { DecimalTransformer } from '../../../common/transformers/decimal.transformer';

export enum UnderpaymentStatus {
  DETECTED = 'detected',
  INVESTIGATING = 'investigating',
  DISPUTED = 'disputed',
  RECOVERED = 'recovered',
  WRITTEN_OFF = 'written_off',
  FALSE_POSITIVE = 'false_positive',
}

@Entity('underpayment_records')
@Index(['tenantId', 'status'])
@Index(['tenantId', 'payerName'])
@Index(['tenantId', 'claimId'])
export class UnderpaymentRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  @Index()
  tenantId!: string;

  // Links
  @Column({ name: 'claim_id', type: 'uuid', nullable: true })
  @Index()
  claimId!: string | null;

  @Column({ name: 'claim_number', type: 'varchar', length: 50, nullable: true })
  claimNumber!: string | null;

  @Column({ name: 'remittance_claim_id', type: 'uuid', nullable: true })
  remittanceClaimId!: string | null;

  @Column({ name: 'service_line_id', type: 'uuid', nullable: true })
  serviceLineId!: string | null;

  // Payer
  @Column({ name: 'payer_name', type: 'varchar', length: 255 })
  payerName!: string;

  @Column({ name: 'payer_id', type: 'uuid', nullable: true })
  payerId!: string | null;

  // CPT code
  @Column({ name: 'cpt_code', type: 'varchar', length: 10 })
  cptCode!: string;

  // Amounts
  @Column({ name: 'billed_amount', type: 'decimal', precision: 12, scale: 2, default: 0, transformer: DecimalTransformer })
  billedAmount!: number;

  @Column({ name: 'expected_amount', type: 'decimal', precision: 12, scale: 2, default: 0, transformer: DecimalTransformer })
  expectedAmount!: number; // Based on contracted rate

  @Column({ name: 'actual_paid_amount', type: 'decimal', precision: 12, scale: 2, default: 0, transformer: DecimalTransformer })
  actualPaidAmount!: number;

  @Column({ name: 'variance_amount', type: 'decimal', precision: 12, scale: 2, default: 0, transformer: DecimalTransformer })
  varianceAmount!: number; // expected - actual

  @Column({ name: 'variance_percentage', type: 'decimal', precision: 5, scale: 2, nullable: true, transformer: DecimalTransformer })
  variancePercentage!: number | null;

  // Contract reference
  @Column({ name: 'contract_id', type: 'uuid', nullable: true })
  contractId!: string | null;

  @Column({ name: 'contracted_rate', type: 'decimal', precision: 12, scale: 2, nullable: true, transformer: DecimalTransformer })
  contractedRate!: number | null;

  // Status
  @Column({ type: 'enum', enum: UnderpaymentStatus, default: UnderpaymentStatus.DETECTED })
  status!: UnderpaymentStatus;

  // Patient
  @Column({ name: 'patient_name', type: 'varchar', length: 255, nullable: true })
  patientName!: string | null;

  // Dates
  @Column({ name: 'service_date', type: 'date', nullable: true })
  serviceDate!: Date | null;

  @Column({ name: 'payment_date', type: 'date', nullable: true })
  paymentDate!: Date | null;

  // Resolution
  @Column({ name: 'recovered_amount', type: 'decimal', precision: 12, scale: 2, nullable: true, transformer: DecimalTransformer })
  recoveredAmount!: number | null;

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
