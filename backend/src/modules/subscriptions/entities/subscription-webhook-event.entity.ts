import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Tracks processed Stripe webhook events for idempotency.
 * Prevents duplicate handling when Stripe retries delivery.
 */
@Entity('subscription_webhook_events')
@Index(['processedAt'])
export class SubscriptionWebhookEvent {
  @PrimaryColumn({ name: 'event_id', type: 'varchar', length: 100 })
  eventId!: string;

  @Column({ name: 'event_type', type: 'varchar', length: 100 })
  eventType!: string;

  @Column({ name: 'provider_subscription_id', type: 'varchar', length: 100 })
  providerSubscriptionId!: string;

  @Column({ name: 'status', type: 'varchar', length: 50 })
  status!: string;

  @Column({ name: 'processed', type: 'boolean', default: true })
  processed!: boolean;

  @Column({ name: 'invoice_id', type: 'varchar', length: 100, nullable: true })
  invoiceId!: string | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;

  @CreateDateColumn({ name: 'processed_at', type: 'timestamptz' })
  processedAt!: Date;
}
