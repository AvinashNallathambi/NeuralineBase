import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { DecimalTransformer } from '../../../common/transformers/decimal.transformer';

export enum EobFormat {
  PDF = 'pdf',
  IMAGE = 'image',
  HTML = 'html',
  JSON = 'json',
}

@Entity('eobs')
@Index(['tenantId', 'patientId'])
@Index(['tenantId', 'claimId'])
@Index(['tenantId', 'payerName'])
export class EOB {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  @Index()
  tenantId!: string;

  @Column({ name: 'patient_id', type: 'uuid', nullable: true })
  patientId!: string | null;

  @Column({ name: 'patient_name', type: 'varchar', length: 255, nullable: true })
  patientName!: string | null;

  @Column({ name: 'claim_id', type: 'uuid', nullable: true })
  @Index()
  claimId!: string | null;

  @Column({ name: 'claim_number', type: 'varchar', length: 50, nullable: true })
  claimNumber!: string | null;

  @Column({ name: 'payer_name', type: 'varchar', length: 255, nullable: true })
  payerName!: string | null;

  @Column({ name: 'eob_date', type: 'date', nullable: true })
  eobDate!: Date | null;

  @Column({ name: 'service_date', type: 'date', nullable: true })
  serviceDate!: Date | null;

  @Column({ type: 'enum', enum: EobFormat, default: EobFormat.PDF })
  format!: EobFormat;

  // Document storage reference (file path, S3 key, or base64 inline)
  @Column({ name: 'document_ref', type: 'text', nullable: true })
  documentRef!: string | null;

  // Structured data extracted from the EOB (via NLP/parsing)
  @Column({ name: 'structured_data', type: 'jsonb', default: {} })
  structuredData!: Record<string, unknown>;

  // Financial summary
  @Column({ name: 'total_billed', type: 'decimal', precision: 12, scale: 2, nullable: true, transformer: DecimalTransformer })
  totalBilled!: number | null;

  @Column({ name: 'total_paid', type: 'decimal', precision: 12, scale: 2, nullable: true, transformer: DecimalTransformer })
  totalPaid!: number | null;

  @Column({ name: 'patient_responsibility', type: 'decimal', precision: 12, scale: 2, nullable: true, transformer: DecimalTransformer })
  patientResponsibility!: number | null;

  @Column({ name: 'adjustment_amount', type: 'decimal', precision: 12, scale: 2, nullable: true, transformer: DecimalTransformer })
  adjustmentAmount!: number | null;

  // Denial info
  @Column({ name: 'is_denied', type: 'boolean', default: false })
  isDenied!: boolean;

  @Column({ name: 'denial_codes', type: 'jsonb', nullable: true })
  denialCodes!: string[] | null;

  @Column({ name: 'denial_reason_text', type: 'text', nullable: true })
  denialReasonText!: string | null;

  @Column({ name: 'metadata', type: 'jsonb', default: {} })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
