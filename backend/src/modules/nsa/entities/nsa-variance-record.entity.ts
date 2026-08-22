import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { DecimalTransformer } from '../../../common/transformers/decimal.transformer';

export enum VarianceRecordStatus {
  DETECTED = 'detected',
  NOTIFIED = 'notified',
  DISPUTED = 'disputed',
  RESOLVED = 'resolved',
  DISMISSED = 'dismissed',
}

@Entity('nsa_variance_records')
@Index(['tenantId', 'gfeId'])
@Index(['tenantId', 'patientId'])
@Index(['tenantId', 'status'])
export class NsaVarianceRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'gfe_id', type: 'uuid' })
  gfeId!: string;

  @Column({ name: 'patient_id', type: 'varchar', length: 100 })
  patientId!: string;

  @Column({ name: 'claim_id', type: 'uuid', nullable: true })
  claimId!: string | null;

  @Column({ name: 'remittance_claim_id', type: 'uuid', nullable: true })
  remittanceClaimId!: string | null;

  @Column({
    name: 'gfe_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: DecimalTransformer,
  })
  gfeAmount!: number;

  @Column({
    name: 'final_billed_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: DecimalTransformer,
  })
  finalBilledAmount!: number;

  @Column({
    name: 'variance_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: DecimalTransformer,
  })
  varianceAmount!: number;

  @Column({ name: 'exceeds_threshold', type: 'boolean', default: false })
  exceedsThreshold!: boolean;

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'detected' })
  status!: VarianceRecordStatus;

  @Column({ name: 'notified_at', type: 'timestamptz', nullable: true })
  notifiedAt!: Date | null;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt!: Date | null;

  @Column({ name: 'resolution_notes', type: 'text', nullable: true })
  resolutionNotes!: string | null;

  @Column({ name: 'per_item_variance', type: 'jsonb', default: [] })
  perItemVariance!: Array<{
    cptCode: string;
    estimated: number;
    actual: number;
    variance: number;
  }>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
