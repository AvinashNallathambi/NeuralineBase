import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { DecimalTransformer } from '../../../common/transformers/decimal.transformer';

export enum SubscriptionInvoiceStatus {
  PAID = 'paid',
  OPEN = 'open',
  FAILED = 'failed',
  VOID = 'void',
  REFUNDED = 'refunded',
}

/**
 * Invoice for a subscription payment (recurring billing history).
 * One record per billing cycle per subscription.
 */
@Entity('subscription_invoices')
@Index(['tenantId', 'subscriptionId'])
@Index(['tenantId', 'status'])
export class SubscriptionInvoice {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  @Index()
  tenantId!: string;

  @Column({ name: 'subscription_id', type: 'uuid' })
  @Index()
  subscriptionId!: string;

  @Column({ name: 'invoice_number', type: 'varchar', length: 50, unique: true })
  invoiceNumber!: string;

  @Column({ name: 'plan_tier', type: 'varchar', length: 50 })
  planTier!: string;

  @Column({ name: 'billing_cycle', type: 'varchar', length: 20 })
  billingCycle!: string; // monthly | annual

  @Column({ name: 'amount', type: 'decimal', precision: 10, scale: 2, transformer: DecimalTransformer })
  amount!: number;

  @Column({ name: 'currency', type: 'varchar', length: 3, default: 'usd' })
  currency!: string;

  @Column({
    type: 'enum',
    enum: SubscriptionInvoiceStatus,
    default: SubscriptionInvoiceStatus.OPEN,
  })
  status!: SubscriptionInvoiceStatus;

  @Column({ name: 'period_start', type: 'timestamptz' })
  periodStart!: Date;

  @Column({ name: 'period_end', type: 'timestamptz' })
  periodEnd!: Date;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt!: Date | null;

  @Column({ name: 'failure_reason', type: 'text', nullable: true })
  failureReason!: string | null;

  @Column({ name: 'stripe_invoice_id', type: 'varchar', length: 100, nullable: true })
  stripeInvoiceId!: string | null;

  @Column({ name: 'stripe_hosted_invoice_url', type: 'varchar', length: 500, nullable: true })
  stripeHostedInvoiceUrl!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
