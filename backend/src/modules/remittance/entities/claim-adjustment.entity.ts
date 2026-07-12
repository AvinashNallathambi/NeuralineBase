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

/**
 * CAS segment — Claim Adjustment.
 * Can be at the claim level (CLP) or service line level (SVD).
 * Links to either remittanceClaimId OR serviceLineId.
 */
export enum AdjustmentGroupCode {
  // CAS01 — group code
  CONTRACTUAL_OBLIGATION = 'CO', // Adjustments for which the provider is financially liable
  OTHER_ADJUSTMENTS = 'OA', // Other adjustments
  PAYER_INITIATED = 'PI', // Payer-initiated reductions
  PATIENT_RESPONSIBILITY = 'PR', // Patient responsibility
}

@Entity('claim_adjustments')
@Index(['tenantId', 'remittanceClaimId'])
@Index(['tenantId', 'serviceLineId'])
@Index(['tenantId', 'carcCode'])
export class ClaimAdjustment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  @Index()
  tenantId!: string;

  // Link to claim or service line
  @Column({ name: 'remittance_claim_id', type: 'uuid', nullable: true })
  @Index()
  remittanceClaimId!: string | null;

  @ManyToOne('RemittanceClaim', 'adjustments', { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'remittance_claim_id' })
  remittanceClaim!: any;

  @Column({ name: 'service_line_id', type: 'uuid', nullable: true })
  @Index()
  serviceLineId!: string | null;

  @ManyToOne('RemittanceServiceLine', 'adjustments', { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'service_line_id' })
  serviceLine!: any;

  // CAS01 — group code
  @Column({ name: 'group_code', type: 'varchar', length: 5 })
  groupCode!: string;

  // CAS02 — Claim Adjustment Reason Code (CARC)
  @Column({ name: 'carc_code', type: 'varchar', length: 10 })
  carcCode!: string;

  @Column({ name: 'carc_description', type: 'text', nullable: true })
  carcDescription!: string | null;

  // CAS03 — monetary amount
  @Column({ name: 'adjustment_amount', type: 'decimal', precision: 12, scale: 2, default: 0, transformer: DecimalTransformer })
  adjustmentAmount!: number;

  // CAS04 — quantity (units)
  @Column({ name: 'quantity', type: 'decimal', precision: 10, scale: 2, nullable: true, transformer: DecimalTransformer })
  quantity!: number | null;

  // RARC — Remittance Advice Remark Codes (CAS07+)
  @Column({ name: 'rarc_code', type: 'varchar', length: 10, nullable: true })
  rarcCode!: string | null;

  @Column({ name: 'rarc_description', type: 'text', nullable: true })
  rarcDescription!: string | null;

  // Derived root cause category (populated by DenialCategoryEngine)
  @Column({ name: 'root_cause_category', type: 'varchar', length: 50, nullable: true })
  rootCauseCategory!: string | null;

  @Column({ name: 'metadata', type: 'jsonb', default: {} })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
