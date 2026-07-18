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
import { DecimalTransformer } from '../../../common/transformers/decimal.transformer';
import { InsurancePayer } from './insurance-payer.entity';

export enum InsuranceRelation {
  SELF = 'self',
  SPOUSE = 'spouse',
  CHILD = 'child',
  OTHER = 'other',
}

export enum InsurancePriority {
  PRIMARY = 'primary',
  SECONDARY = 'secondary',
  TERTIARY = 'tertiary',
}

@Entity('patient_insurances')
@Index(['tenantId', 'patientId', 'priority'])
@Index(['tenantId', 'policyNumber'])
export class PatientInsurance {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  @Index()
  tenantId!: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  @Index()
  patientId!: string;

  @Column({ name: 'insurance_payer_id', type: 'uuid' })
  insurancePayerId!: string;

  @Column({
    type: 'enum',
    enum: InsurancePriority,
    default: InsurancePriority.PRIMARY,
  })
  priority!: InsurancePriority;

  @Column({ name: 'policy_number', type: 'varchar', length: 50 })
  policyNumber!: string;

  @Column({ name: 'group_number', type: 'varchar', length: 50, nullable: true })
  groupNumber!: string | null;

  @Column({ name: 'subscriber_name', type: 'varchar', length: 255 })
  subscriberName!: string;

  @Column({
    type: 'enum',
    enum: InsuranceRelation,
    default: InsuranceRelation.SELF,
  })
  subscriberRelation!: InsuranceRelation;

  @Column({ name: 'subscriber_dob', type: 'date', nullable: true })
  subscriberDob!: Date | null;

  @Column({ name: 'subscriber_ssn', type: 'varchar', length: 20, nullable: true })
  subscriberSsn!: string | null;

  @Column({ name: 'authorization_number', type: 'varchar', length: 50, nullable: true })
  authorizationNumber!: string | null;

  @Column({ name: 'effective_date', type: 'date', nullable: true })
  effectiveDate!: Date | null;

  @Column({ name: 'expiration_date', type: 'date', nullable: true })
  expirationDate!: Date | null;

  @Column({ name: 'copay_amount', type: 'decimal', precision: 10, scale: 2, nullable: true, transformer: DecimalTransformer })
  copayAmount!: number | null;

  @Column({ name: 'deductible_amount', type: 'decimal', precision: 10, scale: 2, nullable: true, transformer: DecimalTransformer })
  deductibleAmount!: number | null;

  @Column({ name: 'coinsurance_percentage', type: 'decimal', precision: 5, scale: 2, nullable: true, transformer: DecimalTransformer })
  coinsurancePercentage!: number | null;

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'active' })
  status!: string;

  @Column({ name: 'card_front_image', type: 'text', nullable: true })
  cardFrontImage!: string | null;

  @Column({ name: 'card_back_image', type: 'text', nullable: true })
  cardBackImage!: string | null;

  @Column({ name: 'card_extracted_confidence', type: 'jsonb', nullable: true })
  cardExtractedConfidence!: Record<string, number> | null;

  @Column({ name: 'metadata', type: 'jsonb', default: {} })
  metadata!: Record<string, unknown>;

  @ManyToOne(() => InsurancePayer, (payer) => payer.id, {
    eager: true,
  })
  @JoinColumn({ name: 'insurance_payer_id' })
  payer!: InsurancePayer;

  @ManyToOne('Patient', 'insurances', {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'patient_id' })
  patient!: unknown;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
