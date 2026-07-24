import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';

export enum DiagnosisCodingSystem {
  ICD_10_CM = 'ICD-10-CM',
  SNOMED_CT = 'SNOMED CT',
  ICD_11 = 'ICD-11',
}

@Entity('favorite_diagnoses')
@Index(['tenantId', 'providerId'])
@Index(['tenantId', 'providerId', 'code'])
export class FavoriteDiagnosis {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'provider_id', type: 'varchar', length: 100, nullable: true })
  providerId!: string | null;

  @Column({ name: 'code', type: 'varchar', length: 20 })
  code!: string;

  @Column({ name: 'code_system', type: 'varchar', length: 20, default: DiagnosisCodingSystem.ICD_10_CM })
  codeSystem!: DiagnosisCodingSystem;

  @Column({ name: 'description', type: 'text' })
  description!: string;

  @Column({ name: 'is_billable', type: 'boolean', default: false })
  isBillable!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
