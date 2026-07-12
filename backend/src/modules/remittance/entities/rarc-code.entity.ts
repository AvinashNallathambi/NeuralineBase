import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * RARC — Remittance Advice Remark Code.
 * Maintained by X12 and published by Washington Publishing Company (WPC).
 * 918+ codes. Provides supplemental information about claim adjustments.
 */
@Entity('rarc_codes')
@Index(['code'], { unique: true })
export class RarcCode {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 10 })
  code!: string; // e.g., "N280", "M50", "MA130"

  @Column({ name: 'code_type', type: 'varchar', length: 20, nullable: true })
  codeType!: string | null; // 'supplemental' or 'informational'

  @Column({ type: 'text' })
  description!: string;

  @Column({ name: 'root_cause_category', type: 'varchar', length: 50, nullable: true })
  rootCauseCategory!: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'deprecation_date', type: 'date', nullable: true })
  deprecationDate!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
