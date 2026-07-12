import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { DecimalTransformer } from '../../../common/transformers/decimal.transformer';
import { Remittance } from './remittance.entity';
import { RemittanceServiceLine } from './remittance-service-line.entity';

export enum RemittanceClaimStatus {
  // X12 835 CLP02 claim status codes
  PROCESSED_AS_PRIMARY = '1',
  PROCESSED_AS_SECONDARY = '2',
  PROCESSED_AS_TERTIARY = '3',
  DENIED = '4',
  PROCESSED_AS_PRIMARY_FORWARDED = '19',
  PROCESSED_AS_SECONDARY_FORWARDED = '20',
  PROCESSED_AS_TERTIARY_FORWARDED = '21',
  REVERSAL_OF_PREVIOUS_PAYMENT = '22',
  NOT_OUR_CLAIM_FORWARDED = '23',
  PREDETERMINATION_PRICING = '25',
}

@Entity('remittance_claims')
@Index(['tenantId', 'remittanceId'])
@Index(['tenantId', 'payerClaimId'])
@Index(['tenantId', 'matchedClaimId'])
export class RemittanceClaim {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  @Index()
  tenantId!: string;

  @Column({ name: 'remittance_id', type: 'uuid' })
  @Index()
  remittanceId!: string;

  @ManyToOne('Remittance', 'claims', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'remittance_id' })
  remittance!: Remittance;

  // Payer's claim identifier (CLP01 — payer claim control number)
  @Column({ name: 'payer_claim_id', type: 'varchar', length: 50 })
  payerClaimId!: string;

  // Our claim number for matching
  @Column({ name: 'matched_claim_id', type: 'uuid', nullable: true })
  @Index()
  matchedClaimId!: string | null;

  @Column({ name: 'matched_claim_number', type: 'varchar', length: 50, nullable: true })
  matchedClaimNumber!: string | null;

  // Patient info from CLP
  @Column({ name: 'patient_name', type: 'varchar', length: 255, nullable: true })
  patientName!: string | null;

  @Column({ name: 'patient_id', type: 'uuid', nullable: true })
  patientId!: string | null;

  // Insured info
  @Column({ name: 'insured_name', type: 'varchar', length: 255, nullable: true })
  insuredName!: string | null;

  @Column({ name: 'facility_type', type: 'varchar', length: 10, nullable: true })
  facilityType!: string | null; // CLP05

  @Column({ name: 'claim_frequency', type: 'varchar', length: 10, nullable: true })
  claimFrequency!: string | null; // CLP06

  @Column({ name: 'service_date', type: 'date', nullable: true })
  serviceDate!: Date | null;

  // Financial amounts (CLP04)
  @Column({ name: 'billed_amount', type: 'decimal', precision: 12, scale: 2, default: 0, transformer: DecimalTransformer })
  billedAmount!: number;

  @Column({ name: 'paid_amount', type: 'decimal', precision: 12, scale: 2, default: 0, transformer: DecimalTransformer })
  paidAmount!: number;

  @Column({ name: 'patient_responsibility_amount', type: 'decimal', precision: 12, scale: 2, default: 0, transformer: DecimalTransformer })
  patientResponsibilityAmount!: number;

  @Column({ name: 'adjusted_amount', type: 'decimal', precision: 12, scale: 2, default: 0, transformer: DecimalTransformer })
  adjustedAmount!: number;

  // CLP02 status code
  @Column({ name: 'claim_status_code', type: 'varchar', length: 5 })
  claimStatusCode!: string;

  // Matching status
  @Column({ name: 'is_matched', type: 'boolean', default: false })
  isMatched!: boolean;

  @Column({ name: 'is_posted', type: 'boolean', default: false })
  isPosted!: boolean;

  @Column({ name: 'posted_at', type: 'timestamptz', nullable: true })
  postedAt!: Date | null;

  @Column({ name: 'metadata', type: 'jsonb', default: {} })
  metadata!: Record<string, unknown>;

  @OneToMany('RemittanceServiceLine', 'remittanceClaim', { cascade: true, eager: false })
  serviceLines!: RemittanceServiceLine[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
