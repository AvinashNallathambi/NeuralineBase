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
import { AppealStatusHistory } from './appeal-status-history.entity';

export enum AppealType {
  FIRST_LEVEL = 'first_level',
  SECOND_LEVEL = 'second_level',
  EXTERNAL_REVIEW = 'external_review',
  FAIR_HEARING = 'fair_hearing',
  RECONSIDERATION = 'reconsideration',
}

export enum AppealStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  UNDER_REVIEW = 'under_review',
  APPROVED = 'approved',
  DENIED = 'denied',
  PARTIALLY_APPROVED = 'partially_approved',
  ESCALATED = 'escalated',
  WITHDRAWN = 'withdrawn',
}

export enum AppealOutcome {
  PENDING = 'pending',
  OVERTURNED = 'overturned',
  UPHELD = 'upheld',
  PARTIALLY_OVERTURNED = 'partially_overturned',
}

@Entity('appeals')
@Index(['tenantId', 'denialId'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'claimId'])
export class Appeal {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  @Index()
  tenantId!: string;

  // Links
  @Column({ name: 'denial_id', type: 'uuid' })
  @Index()
  denialId!: string;

  @Column({ name: 'claim_id', type: 'uuid', nullable: true })
  @Index()
  claimId!: string | null;

  @Column({ name: 'claim_number', type: 'varchar', length: 50, nullable: true })
  claimNumber!: string | null;

  // Link to underpayment record (if this appeal is also disputing an underpayment
  // on the same claim). Populated when an appeal is created from a denial that
  // shares a claimId with an existing UnderpaymentRecord.
  @Column({ name: 'underpayment_id', type: 'uuid', nullable: true })
  @Index()
  underpaymentId!: string | null;

  // Appeal info
  @Column({ name: 'appeal_number', type: 'varchar', length: 50, unique: true })
  appealNumber!: string;

  @Column({ type: 'enum', enum: AppealType, default: AppealType.FIRST_LEVEL })
  appealType!: AppealType;

  @Column({ type: 'enum', enum: AppealStatus, default: AppealStatus.DRAFT })
  status!: AppealStatus;

  @Column({ type: 'enum', enum: AppealOutcome, default: AppealOutcome.PENDING })
  outcome!: AppealOutcome;

  // Payer info
  @Column({ name: 'payer_name', type: 'varchar', length: 255, nullable: true })
  payerName!: string | null;

  @Column({ name: 'payer_address', type: 'text', nullable: true })
  payerAddress!: string | null;

  // Patient info
  @Column({ name: 'patient_name', type: 'varchar', length: 255, nullable: true })
  patientName!: string | null;

  @Column({ name: 'patient_id', type: 'uuid', nullable: true })
  patientId!: string | null;

  // Denial info
  @Column({ name: 'carc_code', type: 'varchar', length: 10, nullable: true })
  carcCode!: string | null;

  @Column({ name: 'denial_reason', type: 'text', nullable: true })
  denialReason!: string | null;

  @Column({ name: 'denied_amount', type: 'decimal', precision: 12, scale: 2, default: 0, transformer: DecimalTransformer })
  deniedAmount!: number;

  // Appeal letter
  @Column({ name: 'appeal_letter', type: 'text', nullable: true })
  appealLetter!: string | null;

  @Column({ name: 'appeal_subject', type: 'varchar', length: 500, nullable: true })
  appealSubject!: string | null;

  // Supporting documents
  @Column({ name: 'supporting_documents', type: 'jsonb', default: [] })
  supportingDocuments!: string[];

  // AI predictions
  @Column({ name: 'success_probability', type: 'decimal', precision: 5, scale: 2, nullable: true, transformer: DecimalTransformer })
  successProbability!: number | null; // 0-100

  @Column({ name: 'ai_rationale', type: 'text', nullable: true })
  aiRationale!: string | null;

  // Dates
  @Column({ name: 'submitted_date', type: 'date', nullable: true })
  submittedDate!: Date | null;

  @Column({ name: 'response_date', type: 'date', nullable: true })
  responseDate!: Date | null;

  @Column({ name: 'deadline_date', type: 'date', nullable: true })
  deadlineDate!: Date | null;

  // Resolution
  @Column({ name: 'recovered_amount', type: 'decimal', precision: 12, scale: 2, nullable: true, transformer: DecimalTransformer })
  recoveredAmount!: number | null;

  @Column({ name: 'resolution_notes', type: 'text', nullable: true })
  resolutionNotes!: string | null;

  // Assignment
  @Column({ name: 'submitted_by', type: 'uuid', nullable: true })
  submittedBy!: string | null;

  @Column({ name: 'submitted_by_name', type: 'varchar', length: 255, nullable: true })
  submittedByName!: string | null;

  @Column({ name: 'metadata', type: 'jsonb', default: {} })
  metadata!: Record<string, unknown>;

  @OneToMany('AppealStatusHistory', 'appeal', { cascade: true, eager: false })
  statusHistory!: AppealStatusHistory[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
