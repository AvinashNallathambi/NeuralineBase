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

@Entity('claim_line_items')
@Index(['claimId', 'codeType', 'code'])
export class ClaimLineItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'claim_id', type: 'uuid' })
  @Index()
  claimId!: string;

  @Column({ name: 'code_type', type: 'varchar', length: 20 })
  codeType!: string;

  @Column({ name: 'code', type: 'varchar', length: 20 })
  code!: string;

  @Column({ name: 'description', type: 'varchar', length: 500 })
  description!: string;

  @Column({ name: 'modifiers', type: 'jsonb', default: [] })
  modifiers!: string[];

  @Column({ name: 'quantity', type: 'int', default: 1 })
  quantity!: number;

  @Column({ name: 'unit_price', type: 'decimal', precision: 10, scale: 2, transformer: DecimalTransformer })
  unitPrice!: number;

  @Column({ name: 'total_charge', type: 'decimal', precision: 10, scale: 2, transformer: DecimalTransformer })
  totalCharge!: number;

  @Column({ name: 'allowed_amount', type: 'decimal', precision: 10, scale: 2, nullable: true, transformer: DecimalTransformer })
  allowedAmount!: number | null;

  @Column({ name: 'paid_amount', type: 'decimal', precision: 10, scale: 2, default: 0, transformer: DecimalTransformer })
  paidAmount!: number;

  @Column({ name: 'patient_responsibility', type: 'decimal', precision: 10, scale: 2, default: 0, transformer: DecimalTransformer })
  patientResponsibility!: number;

  @Column({ name: 'deductible_amount', type: 'decimal', precision: 10, scale: 2, default: 0, transformer: DecimalTransformer })
  deductibleAmount!: number;

  @Column({ name: 'copay_amount', type: 'decimal', precision: 10, scale: 2, default: 0, transformer: DecimalTransformer })
  copayAmount!: number;

  @Column({ name: 'coinsurance_amount', type: 'decimal', precision: 10, scale: 2, default: 0, transformer: DecimalTransformer })
  coinsuranceAmount!: number;

  @Column({ name: 'adjustment_amount', type: 'decimal', precision: 10, scale: 2, default: 0, transformer: DecimalTransformer })
  adjustmentAmount!: number;

  @Column({ name: 'adjustment_reason', type: 'varchar', length: 255, nullable: true })
  adjustmentReason!: string | null;

  @Column({ name: 'service_date', type: 'date', nullable: true })
  serviceDate!: Date | null;

  @Column({ name: 'diagnosis_pointer', type: 'jsonb', default: [] })
  diagnosisPointer!: string[];

  @Column({ name: 'metadata', type: 'jsonb', default: {} })
  metadata!: Record<string, unknown>;

  @ManyToOne('EncounterClaim', 'lineItems', {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'claim_id' })
  claim!: unknown;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
