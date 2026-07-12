import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('lab_reference_ranges')
@Index(['tenantId', 'loincCode'])
@Index(['loincCode'])
export class ReferenceRange {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId!: string | null;

  @Column({ name: 'loinc_code', type: 'varchar', length: 20 })
  loincCode!: string;

  @Column({ name: 'test_name', type: 'varchar', length: 255 })
  testName!: string;

  @Column({ name: 'gender', type: 'varchar', length: 10, default: 'all' })
  gender!: 'male' | 'female' | 'all';

  @Column({ name: 'age_min_days', type: 'int', default: 0 })
  ageMinDays!: number;

  @Column({ name: 'age_max_days', type: 'int', nullable: true })
  ageMaxDays!: number | null;

  @Column({ name: 'low_value', type: 'float', nullable: true })
  lowValue!: number | null;

  @Column({ name: 'high_value', type: 'float', nullable: true })
  highValue!: number | null;

  @Column({ name: 'unit', type: 'varchar', length: 50 })
  unit!: string;

  @Column({ name: 'critical_low', type: 'float', nullable: true })
  criticalLow!: number | null;

  @Column({ name: 'critical_high', type: 'float', nullable: true })
  criticalHigh!: number | null;

  @Column({ name: 'text_range', type: 'varchar', length: 100, nullable: true })
  textRange!: string | null;

  @Column({ name: 'source', type: 'varchar', length: 100, nullable: true })
  source!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
