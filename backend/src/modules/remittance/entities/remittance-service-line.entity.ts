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
import { RemittanceClaim } from './remittance-claim.entity';
import { ClaimAdjustment } from './claim-adjustment.entity';

@Entity('remittance_service_lines')
@Index(['tenantId', 'remittanceClaimId'])
export class RemittanceServiceLine {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  @Index()
  tenantId!: string;

  @Column({ name: 'remittance_claim_id', type: 'uuid' })
  @Index()
  remittanceClaimId!: string;

  @ManyToOne('RemittanceClaim', 'serviceLines', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'remittance_claim_id' })
  remittanceClaim!: RemittanceClaim;

  // SVD segment data
  @Column({ name: 'cpt_code', type: 'varchar', length: 10 })
  cptCode!: string;

  @Column({ name: 'service_id_qualifier', type: 'varchar', length: 5, nullable: true })
  serviceIdQualifier!: string | null; // SVD01 — usually HC for HCPCS

  @Column({ name: 'modifier1', type: 'varchar', length: 5, nullable: true })
  modifier1!: string | null;

  @Column({ name: 'modifier2', type: 'varchar', length: 5, nullable: true })
  modifier2!: string | null;

  @Column({ name: 'modifier3', type: 'varchar', length: 5, nullable: true })
  modifier3!: string | null;

  @Column({ name: 'modifier4', type: 'varchar', length: 5, nullable: true })
  modifier4!: string | null;

  @Column({ name: 'units', type: 'decimal', precision: 10, scale: 2, default: 1, transformer: DecimalTransformer })
  units!: number;

  @Column({ name: 'billed_amount', type: 'decimal', precision: 12, scale: 2, default: 0, transformer: DecimalTransformer })
  billedAmount!: number;

  @Column({ name: 'paid_amount', type: 'decimal', precision: 12, scale: 2, default: 0, transformer: DecimalTransformer })
  paidAmount!: number;

  @Column({ name: 'allowed_amount', type: 'decimal', precision: 12, scale: 2, nullable: true, transformer: DecimalTransformer })
  allowedAmount!: number | null;

  @Column({ name: 'adjusted_amount', type: 'decimal', precision: 12, scale: 2, default: 0, transformer: DecimalTransformer })
  adjustedAmount!: number;

  @Column({ name: 'revenue_code', type: 'varchar', length: 10, nullable: true })
  revenueCode!: string | null;

  @Column({ name: 'service_date', type: 'date', nullable: true })
  serviceDate!: Date | null;

  @Column({ name: 'matched_line_item_id', type: 'uuid', nullable: true })
  matchedLineItemId!: string | null;

  @Column({ name: 'metadata', type: 'jsonb', default: {} })
  metadata!: Record<string, unknown>;

  @OneToMany('ClaimAdjustment', 'serviceLine', { cascade: true, eager: false })
  adjustments!: ClaimAdjustment[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
