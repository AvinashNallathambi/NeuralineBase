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

export enum PatientDocumentType {
  LAB_REPORT = 'lab_report',
  IMAGING = 'imaging',
  CONSENT = 'consent',
  REFERRAL = 'referral',
  INSURANCE_CARD = 'insurance_card',
  IDENTITY = 'identity',
  OTHER = 'other',
}

@Entity('patient_documents')
@Index(['tenantId', 'patientId'])
@Index(['tenantId', 'patientId', 'documentType'])
export class PatientDocument {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId!: string;

  @Column({ name: 'file_name', type: 'varchar', length: 255 })
  fileName!: string;

  @Column({ name: 'stored_file_name', type: 'varchar', length: 255 })
  storedFileName!: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 100 })
  mimeType!: string;

  @Column({ name: 'file_size', type: 'bigint' })
  fileSize!: number;

  @Column({ name: 'document_type', type: 'varchar', length: 30, default: PatientDocumentType.OTHER })
  documentType!: PatientDocumentType;

  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'uploaded_by_user_id', type: 'varchar', length: 64, nullable: true })
  uploadedByUserId!: string | null;

  @Column({ name: 'storage_path', type: 'varchar', length: 512 })
  storagePath!: string;

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
