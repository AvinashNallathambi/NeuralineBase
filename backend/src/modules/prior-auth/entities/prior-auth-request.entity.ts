import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';
import { DecimalTransformer } from '../../../common/transformers/decimal.transformer';

/**
 * Lifecycle of a prior authorization request.
 *
 * draft       → Request created but not yet submitted to payer
 * submitted   → Sent to payer (electronically, fax, portal, or phone)
 * pending     → Awaiting payer decision
 * approved    → Payer approved (may have modifications/conditions)
 * denied      → Payer denied — may trigger appeal or peer-to-peer
 * p2p_scheduled → Peer-to-peer review scheduled with payer medical director
 * appealed    → Appeal submitted after denial
 * expired     → Authorization expired before service was rendered
 * cancelled   → Withdrawn by provider / no longer needed
 * superseded  → Replaced by a newer version (re-auth)
 */
export enum PriorAuthStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  PENDING = 'pending',
  APPROVED = 'approved',
  DENIED = 'denied',
  P2P_SCHEDULED = 'p2p_scheduled',
  APPEALED = 'appealed',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
  SUPERSEDED = 'superseded',
}

/** Benefit type the authorization covers. */
export enum PriorAuthBenefitType {
  MEDICAL = 'medical',
  PHARMACY = 'pharmacy',
}

/** How the request was (or will be) transmitted to the payer. */
export enum PriorAuthSubmissionMethod {
  ELECTRONIC = 'electronic', // X12 278 / FHIR PAS
  PORTAL = 'portal', // Payer web portal
  FAX = 'fax',
  PHONE = 'phone',
  MAIL = 'mail',
}

/** Urgency level — affects payer response deadlines (72h expedited vs 7d standard). */
export enum PriorAuthUrgency {
  STANDARD = 'standard',
  EXPEDITED = 'expedited',
}

export interface PriorAuthCode {
  /** CPT, HCPCS, or NDC (for pharmacy) */
  code: string;
  description: string;
  /** Quantity (units, days supply, etc.) */
  quantity?: number;
}

export interface PriorAuthDiagnosis {
  /** ICD-10 code */
  code: string;
  description: string;
  isPrimary: boolean;
}

export interface PriorAuthClinicalEvidence {
  /** What clinical evidence supports medical necessity */
  summary: string;
  /** Structured evidence items pulled from the chart */
  items: Array<{
    type: 'lab' | 'imaging' | 'medication' | 'procedure' | 'encounter' | 'vital' | 'history';
    description: string;
    date: string;
    value?: string;
    source?: string;
  }>;
}

export interface AiRequirementPrediction {
  /** 0-100, probability that PA is required for this payer × CPT × ICD combo */
  probability: number;
  isRequired: boolean;
  confidence: number;
  factors: Array<{ factor: string; weight: number; detail: string }>;
  rationale: string;
}

export interface AiApprovalPrediction {
  /** 0-100, probability of approval if submitted as-is */
  approvalProbability: number;
  riskLevel: 'low' | 'medium' | 'high';
  factors: Array<{ factor: string; impact: 'positive' | 'negative' | 'neutral'; detail: string }>;
  recommendations: Array<{ action: string; priority: 'urgent' | 'high' | 'medium' | 'low'; detail: string }>;
  missingDocumentation: string[];
}

export interface AiExpirationPrediction {
  /** Predicted expiration date (ISO string) based on payer patterns */
  predictedExpiration: string;
  /** Days until expiration from today */
  daysUntilExpiration: number;
  /** Risk that PA will expire before scheduled service */
  expirationRisk: 'low' | 'medium' | 'high';
  recommendation: string;
}

@Entity('prior_auth_requests')
@Index(['tenantId', 'patientId'])
@Index(['tenantId', 'patientId', 'status'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'payerName'])
@Index(['tenantId', 'assignedTo'])
@Index(['tenantId', 'expirationDate'])
@Index(['tenantId', 'encounterId'])
@Index(['tenantId', 'superbillId'])
export class PriorAuthRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'patient_id', type: 'varchar', length: 100 })
  patientId!: string;

  @Column({ name: 'patient_name', type: 'varchar', length: 200, nullable: true })
  patientName!: string | null;

  @Column({ name: 'encounter_id', type: 'varchar', length: 100, nullable: true })
  encounterId!: string | null;

  @Column({ name: 'superbill_id', type: 'varchar', length: 100, nullable: true })
  superbillId!: string | null;

  @Column({ name: 'provider_id', type: 'varchar', length: 100, nullable: true })
  providerId!: string | null;

  @Column({ name: 'provider_name', type: 'varchar', length: 200, nullable: true })
  providerName!: string | null;

  @Column({ name: 'benefit_type', type: 'varchar', length: 20, default: 'medical' })
  benefitType!: PriorAuthBenefitType;

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'draft' })
  status!: PriorAuthStatus;

  @Column({ name: 'urgency', type: 'varchar', length: 20, default: 'standard' })
  urgency!: PriorAuthUrgency;

  // ── Payer information ──────────────────────────────────────────────
  @Column({ name: 'payer_name', type: 'varchar', length: 255, nullable: true })
  payerName!: string | null;

  @Column({ name: 'payer_id', type: 'varchar', length: 100, nullable: true })
  payerId!: string | null;

  @Column({ name: 'plan_name', type: 'varchar', length: 255, nullable: true })
  planName!: string | null;

  @Column({ name: 'policy_number', type: 'varchar', length: 100, nullable: true })
  policyNumber!: string | null;

  @Column({ name: 'group_number', type: 'varchar', length: 100, nullable: true })
  groupNumber!: string | null;

  @Column({ name: 'eligibility_verification_id', type: 'uuid', nullable: true })
  eligibilityVerificationId!: string | null;

  // ── Codes ──────────────────────────────────────────────────────────
  @Column({ name: 'procedure_codes', type: 'jsonb', default: [] })
  procedureCodes!: PriorAuthCode[];

  @Column({ name: 'diagnosis_codes', type: 'jsonb', default: [] })
  diagnosisCodes!: PriorAuthDiagnosis[];

  // ── Clinical justification ─────────────────────────────────────────
  @Column({ name: 'clinical_evidence', type: 'jsonb', nullable: true })
  clinicalEvidence!: PriorAuthClinicalEvidence | null;

  @Column({ name: 'clinical_notes', type: 'text', nullable: true })
  clinicalNotes!: string | null;

  @Column({ name: 'auth_letter', type: 'text', nullable: true })
  authLetter!: string | null;

  // ── Submission tracking ────────────────────────────────────────────
  @Column({ name: 'submission_method', type: 'varchar', length: 20, nullable: true })
  submissionMethod!: PriorAuthSubmissionMethod | null;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt!: Date | null;

  @Column({ name: 'submitted_by', type: 'varchar', length: 100, nullable: true })
  submittedBy!: string | null;

  // ── Payer response ─────────────────────────────────────────────────
  @Column({ name: 'auth_number', type: 'varchar', length: 100, nullable: true })
  authNumber!: string | null;

  @Column({ name: 'payer_response_at', type: 'timestamptz', nullable: true })
  payerResponseAt!: Date | null;

  @Column({ name: 'payer_decision_notes', type: 'text', nullable: true })
  payerDecisionNotes!: string | null;

  @Column({ name: 'denial_reason', type: 'text', nullable: true })
  denialReason!: string | null;

  @Column({ name: 'denial_code', type: 'varchar', length: 50, nullable: true })
  denialCode!: string | null;

  // ── Validity / expiration ──────────────────────────────────────────
  @Column({ name: 'service_date', type: 'date', nullable: true })
  serviceDate!: Date | null;

  @Column({ name: 'approved_start_date', type: 'date', nullable: true })
  approvedStartDate!: Date | null;

  @Column({ name: 'approved_end_date', type: 'date', nullable: true })
  approvedEndDate!: Date | null;

  @Column({ name: 'expiration_date', type: 'date', nullable: true })
  expirationDate!: Date | null;

  @Column({ name: 'visit_count_approved', type: 'int', nullable: true })
  visitCountApproved!: number | null;

  @Column({ name: 'visits_used', type: 'int', default: 0 })
  visitsUsed!: number;

  // ── Peer-to-peer review ────────────────────────────────────────────
  @Column({ name: 'p2p_scheduled_at', type: 'timestamptz', nullable: true })
  p2pScheduledAt!: Date | null;

  @Column({ name: 'p2p_notes', type: 'text', nullable: true })
  p2pNotes!: string | null;

  // ── Worklist management ────────────────────────────────────────────
  @Column({ name: 'assigned_to', type: 'varchar', length: 100, nullable: true })
  assignedTo!: string | null;

  @Column({ name: 'priority', type: 'int', default: 3 })
  priority!: number; // 1 = highest, 5 = lowest

  @Column({ name: 'due_date', type: 'timestamptz', nullable: true })
  dueDate!: Date | null;

  // ── Financial ──────────────────────────────────────────────────────
  @Column({
    name: 'estimated_cost',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: DecimalTransformer,
  })
  estimatedCost!: number | null;

  // ── Version tracking (for re-authorizations) ───────────────────────
  @Column({ name: 'version', type: 'int', default: 1 })
  version!: number;

  @Column({ name: 'superseded_by_id', type: 'uuid', nullable: true })
  supersededById!: string | null;

  // ── P1: AI Requirement Predictor (A1) ──────────────────────────────
  @Column({ name: 'ai_requirement_prediction', type: 'jsonb', nullable: true })
  aiRequirementPrediction!: AiRequirementPrediction | null;

  // ── P1: AI Approval Probability (A4) ───────────────────────────────
  @Column({ name: 'ai_approval_prediction', type: 'jsonb', nullable: true })
  aiApprovalPrediction!: AiApprovalPrediction | null;

  // ── P1: AI Expiration Predictor (A6) ───────────────────────────────
  @Column({ name: 'ai_expiration_prediction', type: 'jsonb', nullable: true })
  aiExpirationPrediction!: AiExpirationPrediction | null;

  // ── Auto-PA trigger metadata (A2) ──────────────────────────────────
  @Column({ name: 'auto_triggered', type: 'boolean', default: false })
  autoTriggered!: boolean;

  @Column({ name: 'auto_trigger_source', type: 'varchar', length: 100, nullable: true })
  autoTriggerSource!: string | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
