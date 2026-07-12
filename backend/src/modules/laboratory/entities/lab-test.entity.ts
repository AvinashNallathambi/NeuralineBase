import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type LabTestStatus =
  | 'pending'
  | 'collected'
  | 'resulted'
  | 'abnormal'
  | 'critical'
  | 'cancelled';

export type AbnormalFlag =
  | 'normal'
  | 'high'
  | 'low'
  | 'critical_high'
  | 'critical_low';

export type ResultStatus = 'preliminary' | 'final' | 'corrected' | 'amended';

@Entity('lab_tests')
@Index(['tenantId', 'orderId'])
@Index(['tenantId', 'loincCode'])
@Index(['tenantId', 'status'])
export class LabTest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'order_id', type: 'uuid' })
  @Index()
  orderId!: string;

  @Column({ name: 'name', type: 'varchar', length: 255 })
  name!: string;

  @Column({ name: 'loinc_code', type: 'varchar', length: 20, nullable: true })
  loincCode!: string | null;

  @Column({ name: 'cpt_code', type: 'varchar', length: 20, nullable: true })
  cptCode!: string | null;

  @Column({ name: 'category', type: 'varchar', length: 100, nullable: true })
  category!: string | null;

  @Column({ name: 'specimen_type', type: 'varchar', length: 100, nullable: true })
  specimenType!: string | null;

  @Column({
    name: 'status',
    type: 'varchar',
    length: 20,
    default: 'pending',
  })
  status!: LabTestStatus;

  @Column({ name: 'result_value', type: 'varchar', length: 255, nullable: true })
  resultValue!: string | null;

  @Column({ name: 'result_numeric', type: 'float', nullable: true })
  resultNumeric!: number | null;

  @Column({ name: 'unit', type: 'varchar', length: 50, nullable: true })
  unit!: string | null;

  @Column({ name: 'reference_range', type: 'varchar', length: 100, nullable: true })
  referenceRange!: string | null;

  @Column({ name: 'reference_range_low', type: 'float', nullable: true })
  referenceRangeLow!: number | null;

  @Column({ name: 'reference_range_high', type: 'float', nullable: true })
  referenceRangeHigh!: number | null;

  @Column({
    name: 'abnormal_flag',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  abnormalFlag!: AbnormalFlag | null;

  @Column({
    name: 'result_status',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  resultStatus!: ResultStatus | null;

  @Column({ name: 'resulted_at', type: 'timestamptz', nullable: true })
  resultedAt!: Date | null;

  @Column({ name: 'resulted_by', type: 'varchar', length: 100, nullable: true })
  resultedBy!: string | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
