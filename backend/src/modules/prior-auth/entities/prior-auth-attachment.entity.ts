import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Clinical evidence document attached to a prior authorization request.
 * Supports the AI Evidence Auto-Assembler (A3) — AI can auto-generate
 * attachments by pulling from the patient's chart.
 */
@Entity('prior_auth_attachments')
@Index(['tenantId', 'priorAuthRequestId'])
@Index(['tenantId', 'patientId'])
export class PriorAuthAttachment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'prior_auth_request_id', type: 'uuid' })
  priorAuthRequestId!: string;

  @Column({ name: 'patient_id', type: 'varchar', length: 100 })
  patientId!: string;

  /** Document type — what kind of clinical evidence. */
  @Column({ name: 'attachment_type', type: 'varchar', length: 50 })
  attachmentType!: string; // 'lab_result' | 'imaging_report' | 'clinical_notes' | 'medication_history' | 'conservative_treatment' | 'letter' | 'other'

  @Column({ name: 'title', type: 'varchar', length: 255 })
  title!: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string | null;

  /** Inline text content (for AI-generated summaries / extracted evidence). */
  @Column({ name: 'content', type: 'text', nullable: true })
  content!: string | null;

  /** File reference (if uploaded document — stored in object storage). */
  @Column({ name: 'file_url', type: 'varchar', length: 512, nullable: true })
  fileUrl!: string | null;

  @Column({ name: 'file_name', type: 'varchar', length: 255, nullable: true })
  fileName!: string | null;

  @Column({ name: 'mime_type', type: 'varchar', length: 100, nullable: true })
  mimeType!: string | null;

  /** Date the evidence was generated (e.g., lab draw date). */
  @Column({ name: 'evidence_date', type: 'date', nullable: true })
  evidenceDate!: Date | null;

  /** Whether this attachment was auto-assembled by AI (A3). */
  @Column({ name: 'is_ai_generated', type: 'boolean', default: false })
  isAiGenerated!: boolean;

  /** AI confidence that this evidence is relevant to the PA request. */
  @Column({ name: 'ai_relevance_score', type: 'float', nullable: true })
  aiRelevanceScore!: number | null;

  /** Which payer criterion this evidence satisfies. */
  @Column({ name: 'satisfies_criterion', type: 'varchar', length: 255, nullable: true })
  satisfiesCriterion!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
