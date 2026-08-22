import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum DeadlineType {
  OPEN_NEGOTIATION = 'open_negotiation',
  IDR_INITIATION = 'idr_initiation',
  IDR_SUBMISSION = 'idr_submission',
  COOLING_OFF = 'cooling_off',
  PAYER_RESPONSE = 'payer_response',
}

export enum DeadlineStatus {
  UPCOMING = 'upcoming',
  DUE_SOON = 'due_soon',
  OVERDUE = 'overdue',
  MET = 'met',
  MISSED = 'missed',
}

@Entity('nsa_idr_deadlines')
@Index(['tenantId', 'idrCaseId'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'dueDate'])
export class NsaIdrDeadline {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'idr_case_id', type: 'uuid' })
  idrCaseId!: string;

  @Column({ name: 'deadline_type', type: 'varchar', length: 30 })
  deadlineType!: DeadlineType;

  @Column({ name: 'due_date', type: 'timestamptz' })
  dueDate!: Date;

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'upcoming' })
  status!: DeadlineStatus;

  @Column({ name: 'is_met', type: 'boolean', default: false })
  isMet!: boolean;

  @Column({ name: 'met_at', type: 'timestamptz', nullable: true })
  metAt!: Date | null;

  @Column({ name: 'notification_sent', type: 'boolean', default: false })
  notificationSent!: boolean;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
