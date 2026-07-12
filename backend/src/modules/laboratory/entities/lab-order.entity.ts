import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';

export type LabOrderStatus =
  | 'draft'
  | 'ordered'
  | 'collected'
  | 'in_progress'
  | 'resulted'
  | 'completed'
  | 'cancelled';

export type LabPriority = 'routine' | 'urgent' | 'stat' | 'asap';

@Entity('lab_orders')
@Index(['tenantId', 'patientId'])
@Index(['tenantId', 'providerId'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'orderedDate'])
@Index(['tenantId', 'priority'])
export class LabOrder {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'patient_id', type: 'varchar', length: 100 })
  patientId!: string;

  @Column({ name: 'patient_name', type: 'varchar', length: 200 })
  patientName!: string;

  @Column({ name: 'provider_id', type: 'varchar', length: 100 })
  providerId!: string;

  @Column({ name: 'provider_name', type: 'varchar', length: 200 })
  providerName!: string;

  @Column({ name: 'encounter_id', type: 'varchar', length: 100, nullable: true })
  encounterId!: string | null;

  @Column({
    name: 'status',
    type: 'varchar',
    length: 20,
    default: 'draft',
  })
  status!: LabOrderStatus;

  @Column({
    name: 'priority',
    type: 'varchar',
    length: 20,
    default: 'routine',
  })
  priority!: LabPriority;

  @Column({ name: 'fasting_required', type: 'boolean', default: false })
  fastingRequired!: boolean;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'ordered_date', type: 'timestamptz' })
  orderedDate!: Date;

  @Column({ name: 'collected_date', type: 'timestamptz', nullable: true })
  collectedDate!: Date | null;

  @Column({ name: 'completed_date', type: 'timestamptz', nullable: true })
  completedDate!: Date | null;

  @Column({ name: 'lab_facility_id', type: 'varchar', length: 100, nullable: true })
  labFacilityId!: string | null;

  @Column({ name: 'lab_facility_name', type: 'varchar', length: 200, nullable: true })
  labFacilityName!: string | null;

  @Column({ name: 'diagnosis_codes', type: 'jsonb', default: [] })
  diagnosisCodes!: string[];

  @Column({ name: 'aoe_questions', type: 'jsonb', nullable: true })
  aoeQuestions!: Record<string, string> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
