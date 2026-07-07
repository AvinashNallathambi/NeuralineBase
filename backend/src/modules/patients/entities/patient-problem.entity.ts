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

export enum DiagnosisCodingSystem {
  ICD_10_CM = 'ICD-10-CM',
  SNOMED_CT = 'SNOMED CT',
  ICD_11 = 'ICD-11',
}

export enum ProblemClinicalStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  RESOLVED = 'resolved',
}

export enum ProblemVerificationStatus {
  CONFIRMED = 'confirmed',
  UNCONFIRMED = 'unconfirmed',
  REFUTED = 'refuted',
  ENTERED_IN_ERROR = 'entered-in-error',
}

export enum ProblemPriority {
  PRIMARY = 'primary',
  SECONDARY = 'secondary',
}

@Entity('patient_problems')
@Index(['tenantId', 'patientId'])
@Index(['tenantId', 'patientId', 'clinicalStatus'])
@Index(['tenantId', 'patientId', 'isChronic'])
export class PatientProblem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId!: string;

  @Column({ name: 'code', type: 'varchar', length: 20 })
  code!: string;

  @Column({ name: 'code_system', type: 'varchar', length: 20, default: DiagnosisCodingSystem.ICD_10_CM })
  codeSystem!: DiagnosisCodingSystem;

  @Column({ name: 'description', type: 'text' })
  description!: string;

  @Column({ name: 'clinical_status', type: 'varchar', length: 20, default: ProblemClinicalStatus.ACTIVE })
  clinicalStatus!: ProblemClinicalStatus;

  @Column({ name: 'verification_status', type: 'varchar', length: 20, default: ProblemVerificationStatus.CONFIRMED })
  verificationStatus!: ProblemVerificationStatus;

  @Column({ name: 'priority', type: 'varchar', length: 20, nullable: true })
  priority!: ProblemPriority | null;

  @Column({ name: 'is_chronic', type: 'boolean', default: false })
  isChronic!: boolean;

  @Column({ name: 'onset_date', type: 'date', nullable: true })
  onsetDate!: Date | null;

  @Column({ name: 'resolution_date', type: 'date', nullable: true })
  resolutionDate!: Date | null;

  @Column({ name: 'recorded_by', type: 'varchar', length: 64, nullable: true })
  recordedBy!: string | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  @ManyToOne(() => Patient, (patient) => patient.problems, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient;
}
