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

@Entity('patient_surgical_history')
@Index(['tenantId', 'patientId'])
export class PatientSurgicalHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId!: string;

  @Column({ name: 'procedure', type: 'varchar', length: 255 })
  procedure!: string;

  @Column({ name: 'procedure_code', type: 'varchar', length: 20, nullable: true })
  procedureCode!: string | null;

  @Column({ name: 'code_system', type: 'varchar', length: 20, nullable: true })
  codeSystem!: string | null;

  @Column({ name: 'procedure_date', type: 'date', nullable: true })
  procedureDate!: Date | null;

  @Column({ name: 'surgeon', type: 'varchar', length: 200, nullable: true })
  surgeon!: string | null;

  @Column({ name: 'facility', type: 'varchar', length: 255, nullable: true })
  facility!: string | null;

  @Column({ name: 'body_site', type: 'varchar', length: 100, nullable: true })
  bodySite!: string | null;

  @Column({ name: 'outcome', type: 'varchar', length: 50, nullable: true })
  outcome!: string | null;

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
