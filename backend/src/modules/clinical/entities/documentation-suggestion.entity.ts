import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum DocumentationSuggestionKind {
  ORDER = 'order',
  CODING = 'coding',
  CDI = 'cdi',
  PRIOR_AUTH = 'prior_auth',
  AFTER_VISIT_SUMMARY = 'after_visit_summary',
  CLAIM_SCRUB = 'claim_scrub',
  REVENUE_RISK = 'revenue_risk',
}

export enum DocumentationSuggestionStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DISMISSED = 'dismissed',
}

@Entity('documentation_suggestions')
@Index(['sessionId', 'status'])
@Index(['tenantId', 'kind'])
export class DocumentationSuggestion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'session_id', type: 'uuid' })
  sessionId!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'enum', enum: DocumentationSuggestionKind })
  kind!: DocumentationSuggestionKind;

  @Column({ type: 'enum', enum: DocumentationSuggestionStatus, default: DocumentationSuggestionStatus.PENDING })
  status!: DocumentationSuggestionStatus;

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Column({ name: 'evidence_text', type: 'text', nullable: true })
  evidenceText!: string | null;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedBy!: string | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
