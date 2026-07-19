import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('integration_audit_logs')
@Index(['tenantId', 'integrationKey'])
@Index(['tenantId', 'createdAt'])
export class IntegrationAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'integration_key', type: 'varchar', length: 50 })
  integrationKey!: string;

  @Column({ type: 'varchar', length: 50 })
  action!: string;

  @Column({ name: 'performed_by', type: 'varchar', length: 255, nullable: true })
  performedBy!: string | null;

  @Column({ type: 'text', nullable: true })
  detail!: string | null;

  @Column({ name: 'previous_status', type: 'varchar', length: 50, nullable: true })
  previousStatus!: string | null;

  @Column({ name: 'new_status', type: 'varchar', length: 50, nullable: true })
  newStatus!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
