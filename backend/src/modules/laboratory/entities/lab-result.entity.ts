import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('lab_results')
@Index(['tenantId', 'testId'])
@Index(['tenantId', 'orderId'])
@Index(['tenantId', 'isAcknowledged'])
export class LabResult {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'order_id', type: 'uuid' })
  @Index()
  orderId!: string;

  @Column({ name: 'test_id', type: 'uuid' })
  @Index()
  testId!: string;

  @Column({ name: 'value', type: 'varchar', length: 255 })
  value!: string;

  @Column({ name: 'numeric_value', type: 'float', nullable: true })
  numericValue!: number | null;

  @Column({ name: 'unit', type: 'varchar', length: 50, nullable: true })
  unit!: string | null;

  @Column({ name: 'flag', type: 'varchar', length: 20, nullable: true })
  flag!: string | null;

  @Column({ name: 'reference_range', type: 'varchar', length: 100, nullable: true })
  referenceRange!: string | null;

  @Column({ name: 'interpretation', type: 'text', nullable: true })
  interpretation!: string | null;

  @Column({ name: 'result_status', type: 'varchar', length: 20, default: 'final' })
  resultStatus!: string;

  @Column({ name: 'resulted_at', type: 'timestamptz' })
  resultedAt!: Date;

  @Column({ name: 'resulted_by', type: 'varchar', length: 100, nullable: true })
  resultedBy!: string | null;

  @Column({ name: 'is_acknowledged', type: 'boolean', default: false })
  isAcknowledged!: boolean;

  @Column({ name: 'acknowledged_by', type: 'varchar', length: 100, nullable: true })
  acknowledgedBy!: string | null;

  @Column({ name: 'acknowledged_at', type: 'timestamptz', nullable: true })
  acknowledgedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
