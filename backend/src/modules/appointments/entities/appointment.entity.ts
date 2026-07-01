import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';

@Entity('appointments')
@Index(['tenantId', 'patientId'])
@Index(['tenantId', 'providerId'])
@Index(['tenantId', 'startTime'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'groupId'])
export class Appointment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  @Index()
  tenantId!: string;

  @Column({ name: 'patient_id', type: 'varchar', length: 100, nullable: true })
  patientId!: string | null;

  @Column({ name: 'provider_id', type: 'varchar', length: 100 })
  providerId!: string;

  @Column({ name: 'appointment_type', length: 50 })
  appointmentType!: string;

  @Column({ name: 'start_time', type: 'timestamptz' })
  startTime!: Date;

  @Column({ name: 'end_time', type: 'timestamptz' })
  endTime!: Date;

  @Column({ name: 'location', type: 'jsonb', nullable: true })
  location!: {
    type: 'in_person' | 'telehealth' | 'home_visit';
    room?: string;
    address?: string;
    meetingLink?: string;
    meetingId?: string;
  } | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'reason_for_visit', type: 'text', nullable: true })
  reasonForVisit!: string | null;

  @Column({ name: 'status', length: 50, default: 'scheduled' })
  status!: string;

  @Column({ name: 'is_telehealth', type: 'boolean', default: false })
  isTelehealth!: boolean;

  @Column({ name: 'duration_minutes', type: 'int', nullable: true })
  durationMinutes!: number | null;

  @Column({ name: 'reminders_enabled', type: 'boolean', default: true })
  remindersEnabled!: boolean;

  @Column({ name: 'metadata', type: 'jsonb', default: {} })
  metadata!: Record<string, unknown>;

  // Group Appointment Fields
  @Column({ name: 'is_group', type: 'boolean', default: false })
  isGroup!: boolean;

  @Column({ name: 'group_id', type: 'uuid', nullable: true })
  @Index()
  groupId!: string | null;

  @Column({ name: 'max_participants', type: 'int', nullable: true })
  maxParticipants!: number | null;

  @Column({ name: 'group_participants', type: 'jsonb', nullable: true })
  groupParticipants!: {
    patientId: string;
    patientName: string;
    attended: boolean;
    notes?: string;
  }[] | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
