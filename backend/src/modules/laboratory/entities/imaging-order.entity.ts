import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';

export type ImagingModality =
  | 'xray'
  | 'mri'
  | 'ct'
  | 'ultrasound'
  | 'mammogram'
  | 'dexa'
  | 'other';

export type ImagingStatus =
  | 'ordered'
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

@Entity('imaging_orders')
@Index(['tenantId', 'patientId'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'orderedDate'])
export class ImagingOrder {
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

  @Column({ name: 'modality', type: 'varchar', length: 20 })
  modality!: ImagingModality;

  @Column({ name: 'body_part', type: 'varchar', length: 200 })
  bodyPart!: string;

  @Column({ name: 'study_name', type: 'varchar', length: 255 })
  studyName!: string;

  @Column({ name: 'cpt_code', type: 'varchar', length: 20, nullable: true })
  cptCode!: string | null;

  @Column({
    name: 'status',
    type: 'varchar',
    length: 20,
    default: 'ordered',
  })
  status!: ImagingStatus;

  @Column({
    name: 'priority',
    type: 'varchar',
    length: 20,
    default: 'routine',
  })
  priority!: string;

  @Column({ name: 'findings', type: 'text', nullable: true })
  findings!: string | null;

  @Column({ name: 'impression', type: 'text', nullable: true })
  impression!: string | null;

  @Column({ name: 'radiology_report_url', type: 'varchar', length: 500, nullable: true })
  radiologyReportUrl!: string | null;

  @Column({ name: 'ordered_date', type: 'timestamptz' })
  orderedDate!: Date;

  @Column({ name: 'scheduled_date', type: 'timestamptz', nullable: true })
  scheduledDate!: Date | null;

  @Column({ name: 'completed_date', type: 'timestamptz', nullable: true })
  completedDate!: Date | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
