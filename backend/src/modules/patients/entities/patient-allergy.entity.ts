import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Patient } from './patient.entity';

export enum AllergySeverity {
  MILD = 'mild',
  MODERATE = 'moderate',
  SEVERE = 'severe',
  LIFE_THREATENING = 'life-threatening',
}

export enum AllergyStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  RESOLVED = 'resolved',
}

export enum AllergyVerificationStatus {
  CONFIRMED = 'confirmed',
  UNCONFIRMED = 'unconfirmed',
  REFUTED = 'refuted',
  ENTERED_IN_ERROR = 'entered-in-error',
}

@Entity('patient_allergies')
@Index(['tenantId', 'patientId'])
@Index(['tenantId', 'patientId', 'clinicalStatus'])
export class PatientAllergy {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId!: string;

  @Column({ name: 'allergen', type: 'varchar', length: 255 })
  allergen!: string;

  @Column({ name: 'reaction', type: 'text', nullable: true })
  reaction!: string | null;

  @Column({ name: 'severity', type: 'varchar', length: 20, default: AllergySeverity.MODERATE })
  severity!: AllergySeverity;

  @Column({ name: 'clinical_status', type: 'varchar', length: 20, default: AllergyStatus.ACTIVE })
  clinicalStatus!: AllergyStatus;

  @Column({ name: 'verification_status', type: 'varchar', length: 20, default: AllergyVerificationStatus.CONFIRMED })
  verificationStatus!: AllergyVerificationStatus;

  @Column({ name: 'onset_date', type: 'date', nullable: true })
  onsetDate!: Date | null;

  @Column({ name: 'recorded_by', type: 'varchar', length: 64, nullable: true })
  recordedBy!: string | null;

  @Column({ name: 'source', type: 'varchar', length: 20, default: 'staff' })
  source!: string; // 'staff' or 'patient'

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes!: string | null;

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
}
