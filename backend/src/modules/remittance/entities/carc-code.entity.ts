import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * CARC — Claim Adjustment Reason Code.
 * Maintained by X12 and published by Washington Publishing Company (WPC).
 * 253+ codes. Explains why a claim or service line is paid differently than billed.
 */
@Entity('carc_codes')
@Index(['code'], { unique: true })
export class CarcCode {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 10 })
  code!: string; // e.g., "16", "96", "233"

  @Column({ name: 'group_code', type: 'varchar', length: 5, nullable: true })
  groupCode!: string | null; // CO, OA, PI, PR

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
