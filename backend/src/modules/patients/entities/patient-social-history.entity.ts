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

export enum SocialHistoryCategory {
  SMOKING = 'smoking',
  ALCOHOL = 'alcohol',
  SUBSTANCE_USE = 'substance_use',
  OCCUPATION = 'occupation',
  EXERCISE = 'exercise',
  DIET = 'diet',
  CAFFEINE = 'caffeine',
  SEXUAL_HISTORY = 'sexual_history',
  LIVING_SITUATION = 'living_situation',
  MARITAL_STATUS = 'marital_status',
  EDUCATION = 'education',
  TRAVEL = 'travel',
  SAFETY = 'safety',
  ADVANCE_DIRECTIVE = 'advance_directive',
  OTHER = 'other',
}

@Entity('patient_social_history')
@Index(['tenantId', 'patientId'])
@Index(['tenantId', 'patientId', 'category'])
export class PatientSocialHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId!: string;

  @Column({ name: 'category', type: 'varchar', length: 30 })
  category!: SocialHistoryCategory;

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'active' })
  status!: string; // 'current', 'former', 'never', 'unknown'

  @Column({ name: 'detail', type: 'text', nullable: true })
  detail!: string | null;

  @Column({ name: 'frequency', type: 'varchar', length: 100, nullable: true })
  frequency!: string | null;

  @Column({ name: 'amount', type: 'varchar', length: 100, nullable: true })
  amount!: string | null;

  @Column({ name: 'duration_years', type: 'integer', nullable: true })
  durationYears!: number | null;

  @Column({ name: 'quit_date', type: 'date', nullable: true })
  quitDate!: Date | null;

  @Column({ name: 'verification_status', type: 'varchar', length: 20, default: 'confirmed' })
  verificationStatus!: string;

  @Column({ name: 'recorded_by', type: 'varchar', length: 64, nullable: true })
  recordedBy!: string | null;

  @Column({ name: 'source', type: 'varchar', length: 20, default: 'staff' })
  source!: string;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient;
}
