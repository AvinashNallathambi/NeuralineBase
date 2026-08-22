import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { DecimalTransformer } from '../../../common/transformers/decimal.transformer';

export enum IdrJurisdiction {
  FEDERAL = 'federal',
  STATE_CA = 'state_ca',
  STATE_NY = 'state_ny',
  STATE_TX = 'state_tx',
  STATE_NJ = 'state_nj',
  STATE_OTHER = 'state_other',
}

export enum IdrCaseStatus {
  OPEN_NEGOTIATION = 'open_negotiation',
  IDR_INITIATED = 'idr_initiated',
  IDR_SUBMITTED = 'idr_submitted',
  WON = 'won',
  LOST = 'lost',
  WITHDRAWN = 'withdrawn',
  EXPIRED = 'expired',
  SETTLED = 'settled',
}

export interface IdrSupportDocument {
  name: string;
  type: string;
  content: string;
}

@Entity('nsa_idr_cases')
@Index(['tenantId', 'patientId'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'claimId'])
export class NsaIdrCase {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'patient_id', type: 'varchar', length: 100 })
  patientId!: string;

  @Column({ name: 'patient_name', type: 'varchar', length: 200, nullable: true })
  patientName!: string | null;

  @Column({ name: 'claim_id', type: 'uuid', nullable: true })
  claimId!: string | null;

  @Column({ name: 'gfe_id', type: 'uuid', nullable: true })
  gfeId!: string | null;

  @Column({ name: 'variance_record_id', type: 'uuid', nullable: true })
  varianceRecordId!: string | null;

  @Column({ name: 'jurisdiction', type: 'varchar', length: 20, default: 'federal' })
  jurisdiction!: IdrJurisdiction;

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'open_negotiation' })
  status!: IdrCaseStatus;

  @Column({ name: 'payer_name', type: 'varchar', length: 255, nullable: true })
  payerName!: string | null;

  @Column({
    name: 'qpa_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: DecimalTransformer,
  })
  qpaAmount!: number | null;

  @Column({
    name: 'billed_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: DecimalTransformer,
  })
  billedAmount!: number | null;

  @Column({
    name: 'initial_offer',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: DecimalTransformer,
  })
  initialOffer!: number | null;

  @Column({
    name: 'final_offer',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: DecimalTransformer,
  })
  finalOffer!: number | null;

  @Column({
    name: 'determined_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: DecimalTransformer,
  })
  determinedAmount!: number | null;

  @Column({ name: 'open_negotiation_date', type: 'timestamptz', nullable: true })
  openNegotiationDate!: Date | null;

  @Column({ name: 'idr_initiation_deadline', type: 'timestamptz', nullable: true })
  idrInitiationDeadline!: Date | null;

  @Column({ name: 'idr_submission_deadline', type: 'timestamptz', nullable: true })
  idrSubmissionDeadline!: Date | null;

  // P2: AI IDR Eligibility Engine
  @Column({ name: 'eligibility_score', type: 'float', nullable: true })
  eligibilityScore!: number | null;

  @Column({ name: 'eligibility_factors', type: 'jsonb', nullable: true })
  eligibilityFactors!: Array<{ factor: string; weight: number; detail: string }> | null;

  @Column({
    name: 'expected_recovery',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: DecimalTransformer,
  })
  expectedRecovery!: number | null;

  // P3: AI IDR Win-Probability Model
  @Column({ name: 'win_probability', type: 'float', nullable: true })
  winProbability!: number | null;

  @Column({ name: 'win_probability_factors', type: 'jsonb', nullable: true })
  winProbabilityFactors!: Array<{ factor: string; impact: string; detail: string }> | null;

  // P2: AI Open Negotiation Offer
  @Column({ name: 'recommended_offer', type: 'decimal', precision: 12, scale: 2, nullable: true, transformer: DecimalTransformer })
  recommendedOffer!: number | null;

  @Column({ name: 'offer_rationale', type: 'text', nullable: true })
  offerRationale!: string | null;

  // P2: AI Patient Acuity Letter
  @Column({ name: 'patient_acuity_letter', type: 'text', nullable: true })
  patientAcuityLetter!: string | null;

  // P2: Support package
  @Column({ name: 'support_documents', type: 'jsonb', default: [] })
  supportDocuments!: IdrSupportDocument[];

  @Column({ name: 'encounter_notes', type: 'text', nullable: true })
  encounterNotes!: string | null;

  @Column({ name: 'cpt_codes', type: 'jsonb', default: [] })
  cptCodes!: string[];

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt!: Date | null;

  @Column({ name: 'resolution_notes', type: 'text', nullable: true })
  resolutionNotes!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
