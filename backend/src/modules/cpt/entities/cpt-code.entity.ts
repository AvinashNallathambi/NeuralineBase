import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum CptCategory {
  EM = 'E/M', // Evaluation and Management
  SURGERY = 'Surgery',
  MEDICINE = 'Medicine',
  PATHOLOGY = 'Pathology',
  RADIOLOGY = 'Radiology',
  ANESTHESIA = 'Anesthesia',
  LAB = 'Laboratory',
  HCPCS = 'HCPCS',
  OTHER = 'Other',
}

@Entity('cpt_codes')
@Index(['code'], { unique: true })
export class CptCode {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'code', type: 'varchar', length: 10 })
  code!: string;

  @Column({ name: 'description', type: 'text' })
  description!: string;

  @Column({ name: 'category', type: 'varchar', length: 20, nullable: true })
  category!: CptCategory | null;

  @Column({ name: 'default_charge', type: 'numeric', precision: 10, scale: 2, nullable: true })
  defaultCharge!: number | null;

  @Column({ name: 'work_rvu', type: 'numeric', precision: 8, scale: 4, nullable: true })
  workRvu!: number | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
