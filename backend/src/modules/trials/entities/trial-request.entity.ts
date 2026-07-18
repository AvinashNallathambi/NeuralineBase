import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum TrialRequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  ACTIVE = 'active',
  DISABLED = 'disabled',
  CONVERTED = 'converted',
  EXPIRED = 'expired',
  WIPED = 'wiped',
}

export enum TrialPlanType {
  SOLO = 'solo',
  PROFESSIONAL = 'professional',
  ENTERPRISE = 'enterprise',
}

@Entity('trial_requests')
@Index(['status'])
@Index(['email'])
@Index(['tenantId'])
export class TrialRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'email', type: 'varchar', length: 255 })
  email!: string;

  @Column({ name: 'first_name', type: 'varchar', length: 100 })
  firstName!: string;

  @Column({ name: 'last_name', type: 'varchar', length: 100 })
  lastName!: string;

  @Column({ name: 'phone', type: 'varchar', length: 50, nullable: true })
  phone!: string | null;

  @Column({ name: 'practice_name', type: 'varchar', length: 255 })
  practiceName!: string;

  @Column({
    name: 'plan_type',
    type: 'enum',
    enum: TrialPlanType,
  })
  planType!: TrialPlanType;

  @Column({
    type: 'enum',
    enum: TrialRequestStatus,
    default: TrialRequestStatus.PENDING,
  })
  status!: TrialRequestStatus;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId!: string | null;

  @Column({ name: 'admin_user_id', type: 'uuid', nullable: true })
  adminUserId!: string | null;

  @Column({ name: 'trial_ends_at', type: 'timestamptz', nullable: true })
  trialEndsAt!: Date | null;

  @Column({ name: 'disabled_at', type: 'timestamptz', nullable: true })
  disabledAt!: Date | null;

  @Column({ name: 'converted_at', type: 'timestamptz', nullable: true })
  convertedAt!: Date | null;

  @Column({ name: 'wiped_at', type: 'timestamptz', nullable: true })
  wipedAt!: Date | null;

  @Column({ name: 'deletion_warning_sent_at', type: 'timestamptz', nullable: true })
  deletionWarningSentAt!: Date | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
