import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum NotificationType {
  TRIAL_ENDING = 'trial_ending',
  TRIAL_EXPIRED = 'trial_expired',
  PAYMENT_FAILED = 'payment_failed',
  PAYMENT_SUCCEEDED = 'payment_succeeded',
  RENEWAL_UPCOMING = 'renewal_upcoming',
  SUBSCRIPTION_CANCELLED = 'subscription_cancelled',
  PLAN_CHANGED = 'plan_changed',
  DUNNING_REMINDER = 'dunning_reminder',
  ACCOUNT_SUSPENDED = 'account_suspended',
  GENERAL = 'general',
}

export enum NotificationChannel {
  IN_APP = 'in_app',
  EMAIL = 'email',
  SMS = 'sms',
}

export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

@Entity('notifications')
@Index(['tenantId', 'isRead'])
@Index(['tenantId', 'type'])
@Index(['tenantId', 'createdAt'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  @Index()
  tenantId!: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  @Index()
  userId!: string | null; // null = broadcast to all tenant users

  @Column({
    type: 'enum',
    enum: NotificationType,
    default: NotificationType.GENERAL,
  })
  type!: NotificationType;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text' })
  message!: string;

  @Column({
    type: 'enum',
    enum: NotificationPriority,
    default: NotificationPriority.MEDIUM,
  })
  priority!: NotificationPriority;

  @Column({ name: 'action_url', type: 'varchar', length: 500, nullable: true })
  actionUrl!: string | null;

  @Column({ name: 'action_label', type: 'varchar', length: 100, nullable: true })
  actionLabel!: string | null;

  @Column({ name: 'is_read', type: 'boolean', default: false })
  isRead!: boolean;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt!: Date | null;

  @Column({ name: 'email_sent', type: 'boolean', default: false })
  emailSent!: boolean;

  @Column({ name: 'email_sent_at', type: 'timestamptz', nullable: true })
  emailSentAt!: Date | null;

  @Column({ name: 'metadata', type: 'jsonb', default: {} })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
