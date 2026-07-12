import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('prescription_status_history')
@Index(['tenantId', 'prescriptionId'])
export class PrescriptionStatusHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'prescription_id', type: 'uuid' })
  @Index()
  prescriptionId!: string;

  @Column({ name: 'previous_status', type: 'varchar', length: 20, nullable: true })
  previousStatus!: string | null;

  @Column({ name: 'new_status', type: 'varchar', length: 20 })
  newStatus!: string;

  @Column({ name: 'changed_by', type: 'varchar', length: 100, nullable: true })
  changedBy!: string | null;

  @Column({ name: 'reason', type: 'text', nullable: true })
  reason!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
