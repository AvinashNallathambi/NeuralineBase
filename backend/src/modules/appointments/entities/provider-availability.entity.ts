import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';

@Entity('provider_availabilities')
@Index(['tenantId', 'providerId'])
@Index(['tenantId', 'dayOfWeek'])
@Index(['tenantId', 'providerId', 'dayOfWeek'])
export class ProviderAvailability {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  @Index()
  tenantId!: string;

  @Column({ name: 'provider_id', type: 'varchar', length: 100 })
  @Index()
  providerId!: string;

  @Column({ name: 'day_of_week', type: 'int' })
  @Index()
  dayOfWeek!: number; // 0 = Sunday, 6 = Saturday

  @Column({ name: 'start_time', type: 'time' })
  startTime!: string; // HH:MM format

  @Column({ name: 'end_time', type: 'time' })
  endTime!: string; // HH:MM format

  @Column({ name: 'is_available', type: 'boolean', default: true })
  isAvailable!: boolean;

  @Column({ name: 'appointment_types', type: 'jsonb', nullable: true })
  appointmentTypes!: string[]; // Array of appointment types that can be booked

  @Column({ name: 'location_id', type: 'varchar', length: 100, nullable: true })
  locationId!: string | null;

  @Column({ name: 'max_appointments', type: 'int', nullable: true })
  maxAppointments!: number | null; // Maximum number of appointments per slot

  @Column({ name: 'buffer_minutes', type: 'int', default: 0 })
  bufferMinutes!: number; // Buffer time between appointments

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'is_recurring', type: 'boolean', default: true })
  isRecurring!: boolean;

  @Column({ name: 'effective_date', type: 'date', nullable: true })
  effectiveDate!: Date | null;

  @Column({ name: 'expiry_date', type: 'date', nullable: true })
  expiryDate!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
