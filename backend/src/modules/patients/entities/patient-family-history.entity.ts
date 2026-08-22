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

export enum FamilyMemberRelationship {
  FATHER = 'father',
  MOTHER = 'mother',
  BROTHER = 'brother',
  SISTER = 'sister',
  SON = 'son',
  DAUGHTER = 'daughter',
  GRANDFATHER = 'grandfather',
  GRANDMOTHER = 'grandmother',
  UNCLE = 'uncle',
  AUNT = 'aunt',
  COUSIN = 'cousin',
  NIECE = 'niece',
  NEPHEW = 'nephew',
  SPOUSE = 'spouse',
  OTHER = 'other',
}

export enum FamilyHistoryStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ENTERED_IN_ERROR = 'entered-in-error',
}

@Entity('patient_family_history')
@Index(['tenantId', 'patientId'])
@Index(['tenantId', 'patientId', 'relationship'])
export class PatientFamilyHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId!: string;

  @Column({ name: 'relationship', type: 'varchar', length: 20 })
  relationship!: FamilyMemberRelationship;

  @Column({ name: 'member_name', type: 'varchar', length: 100, nullable: true })
  memberName!: string | null;

  @Column({ name: 'condition', type: 'varchar', length: 255 })
  condition!: string;

  @Column({ name: 'code', type: 'varchar', length: 20, nullable: true })
  code!: string | null;

  @Column({ name: 'code_system', type: 'varchar', length: 20, nullable: true })
  codeSystem!: string | null;

  @Column({ name: 'age_of_onset', type: 'integer', nullable: true })
  ageOfOnset!: number | null;

  @Column({ name: 'is_deceased', type: 'boolean', default: false })
  isDeceased!: boolean;

  @Column({ name: 'age_at_death', type: 'integer', nullable: true })
  ageAtDeath!: number | null;

  @Column({ name: 'clinical_status', type: 'varchar', length: 20, default: FamilyHistoryStatus.ACTIVE })
  clinicalStatus!: FamilyHistoryStatus;

  @Column({ name: 'verification_status', type: 'varchar', length: 20, default: 'unconfirmed' })
  verificationStatus!: string; // 'confirmed' | 'unconfirmed' | 'refuted' | 'entered-in-error'

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
