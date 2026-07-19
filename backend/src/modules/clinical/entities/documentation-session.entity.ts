import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum DocumentationSessionStatus {
  DRAFT = 'draft',
  TRANSCRIBED = 'transcribed',
  NOTE_GENERATED = 'note_generated',
  REVIEWED = 'reviewed',
  SIGNED = 'signed',
  CANCELLED = 'cancelled',
}

export enum DocumentationConsentStatus {
  PENDING = 'pending',
  GRANTED = 'granted',
  DECLINED = 'declined',
  PROVIDER_DICTATION = 'provider_dictation',
}

export enum AudioRetentionPolicy {
  DELETE_AFTER_TRANSCRIPTION = 'delete_after_transcription',
}

export interface TranscriptUtterance {
  speaker: string;
  text: string;
  start: number;
  end: number;
  confidence: number;
}

export interface DocumentationSoapNote {
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
}

@Entity('documentation_sessions')
@Index(['tenantId', 'patientId', 'createdAt'])
@Index(['tenantId', 'providerId', 'status'])
@Index(['tenantId', 'encounterId'])
export class DocumentationSession {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  @Index()
  tenantId!: string;

  @Column({ name: 'encounter_id', type: 'uuid', nullable: true })
  encounterId!: string | null;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId!: string;

  @Column({ name: 'provider_id', type: 'uuid' })
  providerId!: string;

  @Column({ type: 'enum', enum: DocumentationSessionStatus, default: DocumentationSessionStatus.DRAFT })
  status!: DocumentationSessionStatus;

  @Column({ name: 'consent_status', type: 'enum', enum: DocumentationConsentStatus, default: DocumentationConsentStatus.PENDING })
  consentStatus!: DocumentationConsentStatus;

  @Column({ name: 'consent_captured_by', type: 'uuid', nullable: true })
  consentCapturedBy!: string | null;

  @Column({ name: 'consent_captured_at', type: 'timestamptz', nullable: true })
  consentCapturedAt!: Date | null;

  @Column({ name: 'consent_method', type: 'varchar', length: 100, nullable: true })
  consentMethod!: string | null;

  @Column({ name: 'audio_retention_policy', type: 'enum', enum: AudioRetentionPolicy, default: AudioRetentionPolicy.DELETE_AFTER_TRANSCRIPTION })
  audioRetentionPolicy!: AudioRetentionPolicy;

  @Column({ name: 'audio_deleted_at', type: 'timestamptz', nullable: true })
  audioDeletedAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  transcript!: string | null;

  @Column({ name: 'transcript_language', type: 'varchar', length: 20, nullable: true })
  transcriptLanguage!: string | null;

  @Column({ name: 'transcript_confidence', type: 'decimal', precision: 5, scale: 4, nullable: true })
  transcriptConfidence!: number | null;

  @Column({ name: 'transcript_utterances', type: 'jsonb', default: [] })
  transcriptUtterances!: TranscriptUtterance[];

  @Column({ name: 'soap_note', type: 'jsonb', default: {} })
  soapNote!: DocumentationSoapNote;

  @Column({ name: 'ai_model', type: 'varchar', length: 255, nullable: true })
  aiModel!: string | null;

  @Column({ name: 'signed_at', type: 'timestamptz', nullable: true })
  signedAt!: Date | null;

  @Column({ name: 'signed_by', type: 'uuid', nullable: true })
  signedBy!: string | null;

  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
