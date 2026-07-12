import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { DecimalTransformer } from '../../../common/transformers/decimal.transformer';
import { RemittanceClaim } from './remittance-claim.entity';

export enum RemittanceType {
  ERA = 'era', // X12 835 electronic
  EOB = 'eob', // Paper EOB scanned/parsed
  MANUAL = 'manual',
}

export enum RemittanceStatus {
  IMPORTED = 'imported',
  POSTED = 'posted',
  PARTIALLY_POSTED = 'partially_posted',
  ERROR = 'error',
  REVERSED = 'reversed',
}

@Entity('remittances')
@Index(['tenantId', 'traceNumber'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'payerId'])
export class Remittance {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  @Index()
  tenantId!: string;

  @Column({ name: 'trace_number', type: 'varchar', length: 100 })
  traceNumber!: string;

  @Column({ name: 'remittance_date', type: 'date' })
  remittanceDate!: Date;

  @Column({ type: 'enum', enum: RemittanceType, default: RemittanceType.ERA })
  type!: RemittanceType;

  @Column({ type: 'enum', enum: RemittanceStatus, default: RemittanceStatus.IMPORTED })
  status!: RemittanceStatus;

  // Payer information
  @Column({ name: 'payer_id', type: 'uuid', nullable: true })
  payerId!: string | null;

  @Column({ name: 'payer_name', type: 'varchar', length: 255 })
  payerName!: string;

  @Column({ name: 'payer_identifier', type: 'varchar', length: 50, nullable: true })
  payerIdentifier!: string | null; // X12 payer ID

  // Payment information
  @Column({ name: 'payment_method', type: 'varchar', length: 20, nullable: true })
  paymentMethod!: string | null; // EFT, CHECK, etc.

  @Column({ name: 'payment_reference', type: 'varchar', length: 100, nullable: true })
  paymentReference!: string | null; // Check number or EFT trace

  @Column({ name: 'total_payment_amount', type: 'decimal', precision: 12, scale: 2, default: 0, transformer: DecimalTransformer })
  totalPaymentAmount!: number;

  @Column({ name: 'total_claim_count', type: 'int', default: 0 })
  totalClaimCount!: number;

  @Column({ name: 'total_billed_amount', type: 'decimal', precision: 12, scale: 2, default: 0, transformer: DecimalTransformer })
  totalBilledAmount!: number;

  // Raw file storage
  @Column({ name: 'raw_file_content', type: 'text', nullable: true })
  rawFileContent!: string | null;

  @Column({ name: 'file_name', type: 'varchar', length: 255, nullable: true })
  fileName!: string | null;

  // Processing metadata
  @Column({ name: 'posted_count', type: 'int', default: 0 })
  postedCount!: number;

  @Column({ name: 'posted_amount', type: 'decimal', precision: 12, scale: 2, default: 0, transformer: DecimalTransformer })
  postedAmount!: number;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column({ name: 'metadata', type: 'jsonb', default: {} })
  metadata!: Record<string, unknown>;

  @OneToMany('RemittanceClaim', 'remittance', { cascade: true, eager: false })
  claims!: RemittanceClaim[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
