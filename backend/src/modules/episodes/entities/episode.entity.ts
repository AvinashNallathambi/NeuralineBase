import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';

export enum EpisodeStatus {
  ACTIVE = 'active',
  ONHOLD = 'onhold',
  CANCELLED = 'cancelled',
  ENTERED_IN_ERROR = 'entered_in_error',
  FINISHED = 'finished',
  PLANNED = 'planned',
  WAITLIST = 'waitlist',
}

export enum EpisodeType {
  ACUTE = 'acute',
  CHRONIC = 'chronic',
  EPISODIC = 'episodic',
  PERINATAL = 'perinatal',
  SURGICAL = 'surgical',
  BEHAVIORAL = 'behavioral',
  PREVENTIVE = 'preventive',
}

export interface EpisodeCondition {
  code: string;
  codeSystem: string;
  description: string;
  isPrimary: boolean;
}

export interface EpisodeCareTeamMember {
  providerId: string;
  name: string;
  role: string;
  isActive: boolean;
  joinedAt: string;
}

export interface EpisodeCostSummary {
  totalEncounterCost: number;
  totalLabCost: number;
  totalImagingCost: number;
  totalMedicationCost: number;
  totalCost: number;
  estimatedCost: number | null;
  costVariance: number | null;
  lastCalculatedAt: string;
}

export interface EpisodeOutcome {
  clinicalOutcome: 'improved' | 'stable' | 'deteriorated' | 'resolved' | 'unknown';
  patientSatisfaction: number | null;
  qualityMeasureCompliance: number | null;
  notes: string;
  assessedAt: string;
  assessedBy: string;
}

export interface EpisodeAiInsight {
  autoDetected: boolean;
  detectionConfidence: number;
  predictedTotalCost: number | null;
  pathwayDeviations: string[];
  recommendedActions: string[];
  riskScore: number | null;
  generatedAt: string;
}

@Entity('episodes')
export class Episode {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  @Index('IDX_episode_tenant')
  tenantId!: string;

  @Column({ name: 'patient_id', type: 'varchar', length: 100 })
  @Index('IDX_episode_tenant_patient')
  patientId!: string;

  @Column({ name: 'patient_name', type: 'varchar', length: 200 })
  patientName!: string;

  @Column({ name: 'title', type: 'varchar', length: 255 })
  title!: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'episode_type', type: 'varchar', length: 20, default: EpisodeType.ACUTE })
  episodeType!: EpisodeType;

  @Column({ name: 'status', type: 'varchar', length: 20, default: EpisodeStatus.ACTIVE })
  @Index('IDX_episode_tenant_status')
  status!: EpisodeStatus;

  // FHIR EpisodeOfCare.status — tracks the lifecycle
  // planned | waitlist | active | onhold | finished | cancelled | entered_in_error

  @Column({ name: 'conditions', type: 'jsonb', default: [] })
  conditions!: EpisodeCondition[];

  // ICD-10 / SNOMED codes that this episode addresses
  // Primary condition is the one with isPrimary: true

  @Column({ name: 'care_team', type: 'jsonb', default: [] })
  careTeam!: EpisodeCareTeamMember[];

  @Column({ name: 'managing_provider_id', type: 'varchar', length: 100, nullable: true })
  managingProviderId!: string | null;

  @Column({ name: 'managing_provider_name', type: 'varchar', length: 200, nullable: true })
  managingProviderName!: string | null;

  @Column({ name: 'start_date', type: 'timestamptz' })
  startDate!: Date;

  @Column({ name: 'end_date', type: 'timestamptz', nullable: true })
  endDate!: Date | null;

  // Linked encounter IDs — the encounters that belong to this episode
  @Column({ name: 'encounter_ids', type: 'jsonb', default: [] })
  encounterIds!: string[];

  // Linked care plan IDs
  @Column({ name: 'care_plan_ids', type: 'jsonb', default: [] })
  carePlanIds!: string[];

  // Cost tracking
  @Column({ name: 'cost_summary', type: 'jsonb', nullable: true })
  costSummary!: EpisodeCostSummary | null;

  // Outcome tracking
  @Column({ name: 'outcome', type: 'jsonb', nullable: true })
  outcome!: EpisodeOutcome | null;

  // AI insights
  @Column({ name: 'ai_insights', type: 'jsonb', nullable: true })
  aiInsights!: EpisodeAiInsight | null;

  // Episode timeline — aggregated events
  @Column({ name: 'timeline', type: 'jsonb', default: [] })
  timeline!: Array<{
    date: string;
    type: 'encounter' | 'lab' | 'imaging' | 'medication' | 'care_plan' | 'referral' | 'note';
    title: string;
    description: string;
    encounterId?: string;
  }>;

  @Column({ name: 'tags', type: 'jsonb', default: [] })
  tags!: string[];

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes!: string | null;

  // FHIR mapping — the FHIR EpisodeOfCare resource ID if synced
  @Column({ name: 'fhir_episode_id', type: 'varchar', length: 100, nullable: true })
  fhirEpisodeId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
