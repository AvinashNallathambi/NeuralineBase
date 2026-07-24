import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Patient } from './patient.entity';

export enum PatientFlagSeverity {
  CRITICAL = 'critical',
  WARNING = 'warning',
  INFORMATIONAL = 'informational',
}

export enum PatientFlagCategory {
  GENERAL = 'general',
  SAFETY = 'safety',
  BEHAVIORAL = 'behavioral',
  LEGAL = 'legal',
  CLINICAL = 'clinical',
  ADMINISTRATIVE = 'administrative',
}

export enum PatientFlagStatus {
  ACTIVE = 'active',
  RESOLVED = 'resolved',
}

@Entity('patient_flags')
@Index(['tenantId', 'patientId'])
@Index(['tenantId', 'patientId', 'status'])
@Index(['tenantId', 'patientId', 'severity'])
@Index(['tenantId', 'patientId', 'showAsBanner'])
export class PatientFlag {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId!: string;

  @Column({ name: 'type', type: 'varchar', length: 80 })
  type!: string;

  @Column({
    name: 'category',
    type: 'varchar',
    length: 30,
    default: PatientFlagCategory.GENERAL,
  })
  category!: PatientFlagCategory;

  @Column({
    name: 'severity',
    type: 'varchar',
    length: 20,
    default: PatientFlagSeverity.WARNING,
  })
  severity!: PatientFlagSeverity;

  @Column({
    name: 'status',
    type: 'varchar',
    length: 20,
    default: PatientFlagStatus.ACTIVE,
  })
  status!: PatientFlagStatus;

  @Column({ name: 'show_as_banner', type: 'boolean', default: false })
  showAsBanner!: boolean;

  @Column({ name: 'note', type: 'text', nullable: true })
  note!: string | null;

  @Column({ name: 'created_by_user_id', type: 'varchar', length: 64, nullable: true })
  createdByUserId!: string | null;

  @Column({ name: 'resolved_by_user_id', type: 'varchar', length: 64, nullable: true })
  resolvedByUserId!: string | null;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt!: Date | null;

  @Column({ name: 'resolution_reason', type: 'text', nullable: true })
  resolutionReason!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  @ManyToOne(() => Patient, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient;

  @OneToMany('PatientFlagAcknowledgement', 'flag')
  acknowledgements!: unknown[];
}

@Entity('patient_flag_acknowledgements')
@Index(['tenantId', 'flagId', 'userId'], { unique: true })
@Index(['tenantId', 'userId'])
export class PatientFlagAcknowledgement {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'flag_id', type: 'uuid' })
  flagId!: string;

  @Column({ name: 'user_id', type: 'varchar', length: 64 })
  userId!: string;

  @Column({ name: 'user_email', type: 'varchar', length: 255, nullable: true })
  userEmail!: string | null;

  @CreateDateColumn({ name: 'acknowledged_at', type: 'timestamptz' })
  acknowledgedAt!: Date;

  @ManyToOne(() => PatientFlag, (flag) => flag.acknowledgements, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'flag_id' })
  flag!: PatientFlag;
}
