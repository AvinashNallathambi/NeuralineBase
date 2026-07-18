import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum PaymentPlanStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  PAST_DUE = 'past_due',
}

export enum PaymentPlanFrequency {
  WEEKLY = 'weekly',
  BIWEEKLY = 'biweekly',
  MONTHLY = 'monthly',
}

/**
 * A payment plan for splitting a balance across scheduled installments.
 * Used for high-cost treatment balances or outstanding subscription invoices.
 */
@Entity('subscription_payment_plans')
@Index(['tenantId'])
@Index(['tenantId', 'status'])
export class SubscriptionPaymentPlan {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'subscription_id', type: 'uuid', nullable: true })
  subscriptionId!: string | null;

  @Column({ name: 'description', type: 'varchar', length: 255 })
  description!: string;

  @Column({ name: 'total_amount', type: 'decimal', precision: 10, scale: 2 })
  totalAmount!: number;

  @Column({ name: 'paid_amount', type: 'decimal', precision: 10, scale: 2, default: 0 })
  paidAmount!: number;

  @Column({
    name: 'installment_amount',
    type: 'decimal',
    precision: 10,
    scale: 2,
  })
  installmentAmount!: number;

  @Column({
    type: 'enum',
    enum: PaymentPlanFrequency,
    default: PaymentPlanFrequency.MONTHLY,
  })
  frequency!: PaymentPlanFrequency;

  @Column({ name: 'total_installments', type: 'integer' })
  totalInstallments!: number;

  @Column({ name: 'paid_installments', type: 'integer', default: 0 })
  paidInstallments!: number;

  @Column({
    type: 'enum',
    enum: PaymentPlanStatus,
    default: PaymentPlanStatus.ACTIVE,
  })
  status!: PaymentPlanStatus;

  @Column({ name: 'next_payment_date', type: 'timestamptz', nullable: true })
  nextPaymentDate!: Date | null;

  @Column({ name: 'start_date', type: 'timestamptz' })
  startDate!: Date;

  @Column({ name: 'end_date', type: 'timestamptz', nullable: true })
  endDate!: Date | null;

  @Column({ name: 'stripe_payment_method_id', type: 'varchar', length: 100, nullable: true })
  stripePaymentMethodId!: string | null;

  @Column({ name: 'metadata', type: 'jsonb', default: {} })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
