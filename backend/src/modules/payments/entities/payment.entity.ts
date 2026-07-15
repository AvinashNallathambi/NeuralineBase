import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { DecimalTransformer } from '../../../common/transformers/decimal.transformer';

export enum PaymentStatus {
  PENDING = 'pending',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  CANCELLED = 'cancelled',
}

export enum PaymentMethod {
  CARD = 'card',
  ACH = 'ach',
  CASH = 'cash',
  CHECK = 'check',
  OTHER = 'other',
}

@Entity('payments')
@Index(['tenantId', 'invoiceId'])
@Index(['tenantId', 'patientId'])
@Index(['tenantId', 'status'])
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  @Index()
  tenantId!: string;

  @Column({ name: 'invoice_id', type: 'uuid', nullable: true })
  @Index()
  invoiceId!: string | null;

  @Column({ name: 'patient_id', type: 'uuid' })
  @Index()
  patientId!: string;

  @Column({ name: 'patient_name', type: 'varchar', length: 255 })
  patientName!: string;

  @Column({ name: 'amount', type: 'decimal', precision: 10, scale: 2, transformer: DecimalTransformer })
  amount!: number;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  status!: PaymentStatus;

  @Column({
    type: 'enum',
    enum: PaymentMethod,
    default: PaymentMethod.CARD,
  })
  method!: PaymentMethod;

  /** Provider used (stripe | mock | cash | check) */
  @Column({ name: 'provider', type: 'varchar', length: 50 })
  provider!: string;

  /** Provider-side identifier (e.g. Stripe PaymentIntent id or charge id) */
  @Column({ name: 'provider_payment_id', type: 'varchar', length: 255, nullable: true })
  providerPaymentId!: string | null;

  /** Client secret returned to the browser for Stripe.js confirmation */
  @Column({ name: 'client_secret', type: 'varchar', length: 500, nullable: true })
  clientSecret!: string | null;

  @Column({ name: 'currency', type: 'varchar', length: 3, default: 'usd' })
  currency!: string;

  @Column({ name: 'description', type: 'varchar', length: 500, nullable: true })
  description!: string | null;

  @Column({ name: 'failure_reason', type: 'text', nullable: true })
  failureReason!: string | null;

  @Column({ name: 'metadata', type: 'jsonb', default: {} })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
