import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';

@Entity('prescription_refills')
@Index(['tenantId', 'prescriptionId'])
@Index(['tenantId', 'status'])
export class PrescriptionRefill {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'prescription_id', type: 'uuid' })
  @Index()
  prescriptionId!: string;

  @Column({ name: 'patient_name', type: 'varchar', length: 200 })
  patientName!: string;

  @Column({ name: 'medication', type: 'varchar', length: 255 })
  medication!: string;

  @Column({ name: 'dosage', type: 'varchar', length: 50 })
  dosage!: string;

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'pending' })
  status!: string;

  @Column({ name: 'requested_by', type: 'varchar', length: 100, nullable: true })
  requestedBy!: string | null;

  @Column({ name: 'reviewed_by', type: 'varchar', length: 100, nullable: true })
  reviewedBy!: string | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt!: Date | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
