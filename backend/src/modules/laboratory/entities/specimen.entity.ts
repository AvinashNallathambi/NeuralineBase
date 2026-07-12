import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type SpecimenCondition =
  | 'good'
  | 'hemolyzed'
  | 'clotted'
  | 'insufficient'
  | 'rejected';

@Entity('lab_specimens')
@Index(['tenantId', 'orderId'])
@Index(['tenantId', 'trackingNumber'])
export class Specimen {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'order_id', type: 'uuid' })
  @Index()
  orderId!: string;

  @Column({ name: 'test_id', type: 'uuid', nullable: true })
  testId!: string | null;

  @Column({ name: 'specimen_type', type: 'varchar', length: 100 })
  specimenType!: string;

  @Column({ name: 'collection_method', type: 'varchar', length: 100, nullable: true })
  collectionMethod!: string | null;

  @Column({ name: 'volume', type: 'varchar', length: 50, nullable: true })
  volume!: string | null;

  @Column({ name: 'container_type', type: 'varchar', length: 100, nullable: true })
  containerType!: string | null;

  @Column({ name: 'collected_at', type: 'timestamptz', nullable: true })
  collectedAt!: Date | null;

  @Column({ name: 'collected_by', type: 'varchar', length: 100, nullable: true })
  collectedBy!: string | null;

  @Column({ name: 'received_at_lab_at', type: 'timestamptz', nullable: true })
  receivedAtLabAt!: Date | null;

  @Column({ name: 'received_by', type: 'varchar', length: 100, nullable: true })
  receivedBy!: string | null;

  @Column({
    name: 'condition',
    type: 'varchar',
    length: 20,
    default: 'good',
  })
  condition!: SpecimenCondition;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason!: string | null;

  @Column({ name: 'tracking_number', type: 'varchar', length: 100, nullable: true })
  trackingNumber!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
