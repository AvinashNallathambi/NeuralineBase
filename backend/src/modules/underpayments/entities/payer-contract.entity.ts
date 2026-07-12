import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { DecimalTransformer } from '../../../common/transformers/decimal.transformer';

/**
 * Payer contracted fee schedule by CPT code.
 * Used to calculate expected payments and detect underpayments.
 */
@Entity('payer_contracts')
@Index(['tenantId', 'payerId', 'cptCode'], { unique: true })
export class PayerContract {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  @Index()
  tenantId!: string;

  @Column({ name: 'payer_id', type: 'uuid', nullable: true })
  payerId!: string | null;

  @Column({ name: 'payer_name', type: 'varchar', length: 255 })
  payerName!: string;

  @Column({ name: 'cpt_code', type: 'varchar', length: 10 })
  cptCode!: string;

  @Column({ name: 'cpt_description', type: 'text', nullable: true })
  cptDescription!: string | null;

  // Contracted rate
  @Column({ name: 'contracted_rate', type: 'decimal', precision: 12, scale: 2, transformer: DecimalTransformer })
  contractedRate!: number;

  // Rate type: flat fee, percentage of Medicare, RVU-based, etc.
  @Column({ name: 'rate_type', type: 'varchar', length: 20, default: 'flat' })
  rateType!: string; // flat, medicare_percentage, rvu

  @Column({ name: 'medicare_percentage', type: 'decimal', precision: 5, scale: 2, nullable: true, transformer: DecimalTransformer })
  medicarePercentage!: number | null;

  // Modifiers that affect pricing
  @Column({ name: 'modifier_adjustments', type: 'jsonb', default: {} })
  modifierAdjustments!: Record<string, number>; // e.g., { "25": 1.0, "50": 0.5 }

  // Validity period
  @Column({ name: 'effective_date', type: 'date', nullable: true })
  effectiveDate!: Date | null;

  @Column({ name: 'expiration_date', type: 'date', nullable: true })
  expirationDate!: Date | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'metadata', type: 'jsonb', default: {} })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
