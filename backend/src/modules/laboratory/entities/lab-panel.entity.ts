import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';

export interface LabPanelTest {
  name: string;
  loincCode?: string;
  category?: string;
}

@Entity('lab_panels')
@Index(['tenantId', 'isActive'])
@Index(['tenantId', 'category'])
export class LabPanel {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId!: string | null;

  @Column({ name: 'name', type: 'varchar', length: 255 })
  name!: string;

  @Column({ name: 'code', type: 'varchar', length: 20, nullable: true })
  code!: string | null;

  @Column({ name: 'loinc_code', type: 'varchar', length: 20, nullable: true })
  loincCode!: string | null;

  @Column({ name: 'category', type: 'varchar', length: 100, nullable: true })
  category!: string | null;

  @Column({ name: 'tests', type: 'jsonb', default: [] })
  tests!: LabPanelTest[];

  @Column({ name: 'default_priority', type: 'varchar', length: 20, default: 'routine' })
  defaultPriority!: string;

  @Column({ name: 'fasting_required', type: 'boolean', default: false })
  fastingRequired!: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
