import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Payer-specific prior authorization requirement rules.
 * Lookup table: payer × CPT/HCPCS → is PA required + criteria.
 *
 * This is the deterministic rule engine. The AI Requirement Predictor (A1)
 * layers on top of this to handle ambiguous / missing rules.
 */
@Entity('prior_auth_requirements')
@Index(['tenantId', 'payerName', 'procedureCode'])
@Index(['tenantId', 'payerName'])
@Index(['tenantId', 'procedureCode'])
export class PriorAuthRequirement {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  /** Payer name (e.g., 'Aetna', 'Cigna', 'UnitedHealthcare'). null = applies to all payers. */
  @Column({ name: 'payer_name', type: 'varchar', length: 255, nullable: true })
  payerName!: string | null;

  /** Payer ID (NPI-style or proprietary). null = applies to all. */
  @Column({ name: 'payer_id', type: 'varchar', length: 100, nullable: true })
  payerId!: string | null;

  /** CPT, HCPCS, or NDC code that requires PA. */
  @Column({ name: 'procedure_code', type: 'varchar', length: 20 })
  procedureCode!: string;

  @Column({ name: 'procedure_description', type: 'varchar', length: 255, nullable: true })
  procedureDescription!: string | null;

  /** Whether PA is always required, conditional, or never. */
  @Column({ name: 'requirement_type', type: 'varchar', length: 20, default: 'always' })
  requirementType!: 'always' | 'conditional' | 'never';

  /** Conditions under which PA is required (for conditional type). */
  @Column({ name: 'conditions', type: 'jsonb', default: [] })
  conditions!: Array<{
    field: string; // e.g., 'diagnosis', 'frequency', 'age', 'setting'
    operator: string; // e.g., 'in', '>=', '=='
    value: string;
    description: string;
  }>;

  /** Clinical criteria the payer expects (e.g., "6 weeks conservative therapy"). */
  @Column({ name: 'required_criteria', type: 'jsonb', default: [] })
  requiredCriteria!: Array<{
    criterion: string;
    description: string;
    documentationRequired: boolean;
  }>;

  /** Typical turnaround time for this payer (hours). */
  @Column({ name: 'typical_turnaround_hours', type: 'int', nullable: true })
  typicalTurnaroundHours!: number | null;

  /** Typical PA validity period (days) once approved. */
  @Column({ name: 'typical_validity_days', type: 'int', nullable: true })
  typicalValidityDays!: number | null;

  /** Submission methods supported by this payer. */
  @Column({ name: 'submission_methods', type: 'jsonb', default: ['electronic'] })
  submissionMethods!: string[];

  /** Whether this rule was AI-generated (from denial history learning) or manual. */
  @Column({ name: 'is_ai_generated', type: 'boolean', default: false })
  isAiGenerated!: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'source', type: 'varchar', length: 100, nullable: true })
  source!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
