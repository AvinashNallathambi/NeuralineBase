import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';

export type ProviderAvailabilityOverrideType =
  | 'time_off'
  | 'modified_hours'
  | 'on_call'
  | 'holiday'
  | 'break'
  | 'out_of_office';

@Entity('provider_availability_overrides')
@Index(['tenantId', 'providerId'])
@Index(['tenantId', 'overrideDate'])
export class ProviderAvailabilityOverride {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'provider_id', type: 'varchar', length: 100 })
  providerId!: string;

  @Column({ name: 'override_date', type: 'date' })
  overrideDate!: Date;

  @Column({ name: 'override_type', type: 'varchar', length: 50 })
  overrideType!: ProviderAvailabilityOverrideType;

  @Column({ name: 'is_available', type: 'boolean', default: true })
  isAvailable!: boolean;

  @Column({ name: 'start_time', type: 'time', nullable: true })
  startTime!: string | null;

  @Column({ name: 'end_time', type: 'time', nullable: true })
  endTime!: string | null;

  @Column({ name: 'reason', type: 'text', nullable: true })
  reason!: string | null;

  @Column({ name: 'is_recurring', type: 'boolean', default: false })
  isRecurring!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
