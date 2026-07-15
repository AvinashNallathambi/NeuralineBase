import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';

export enum TelemedicineSessionStatus {
  SCHEDULED = 'scheduled',
  WAITING = 'waiting',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no_show',
}

export enum RecordingStatus {
  NOT_STARTED = 'not_started',
  REQUESTED = 'requested',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface TelemedicineParticipant {
  userId: string;
  role: 'provider' | 'patient' | 'interpreter' | 'observer';
  name: string;
  joinedAt?: string;
  leftAt?: string;
  socketId?: string;
}

export interface TelemedicineChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  text: string;
  sentAt: string;
}

export interface SharedFile {
  id: string;
  fileName: string;
  fileType: string;
  url: string;
  uploadedBy: string;
  uploadedAt: string;
}

@Entity('telemedicine_sessions')
@Index(['tenantId', 'appointmentId'])
@Index(['tenantId', 'patientId'])
@Index(['tenantId', 'providerId'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'roomId'])
export class TelemedicineSession {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  @Index()
  tenantId!: string;

  @Column({ name: 'appointment_id', type: 'uuid', nullable: true })
  appointmentId!: string | null;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId!: string;

  @Column({ name: 'provider_id', type: 'uuid' })
  providerId!: string;

  @Column({ name: 'room_id', type: 'varchar', length: 100, unique: true })
  roomId!: string;

  @Column({ name: 'status', length: 50, default: TelemedicineSessionStatus.SCHEDULED })
  status!: TelemedicineSessionStatus;

  @Column({ name: 'participants', type: 'jsonb', default: [] })
  participants!: TelemedicineParticipant[];

  @Column({ name: 'chat_messages', type: 'jsonb', default: [] })
  chatMessages!: TelemedicineChatMessage[];

  @Column({ name: 'shared_files', type: 'jsonb', default: [] })
  sharedFiles!: SharedFile[];

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt!: Date | null;

  @Column({ name: 'ended_at', type: 'timestamptz', nullable: true })
  endedAt!: Date | null;

  @Column({ name: 'duration_minutes', type: 'int', nullable: true })
  durationMinutes!: number | null;

  @Column({ name: 'recording_consent', type: 'boolean', default: false })
  recordingConsent!: boolean;

  @Column({ name: 'recording_status', length: 50, default: RecordingStatus.NOT_STARTED })
  recordingStatus!: RecordingStatus;

  @Column({ name: 'recording_url', type: 'text', nullable: true })
  recordingUrl!: string | null;

  @Column({ name: 'transcript', type: 'text', nullable: true })
  transcript!: string | null;

  @Column({ name: 'soap_note', type: 'jsonb', default: {} })
  soapNote!: {
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
  };

  @Column({ name: 'suggested_codes', type: 'jsonb', nullable: true })
  suggestedCodes!: {
    diagnoses?: Array<{ code: string; description: string; confidence: number; rationale: string }>;
    procedures?: Array<{ code: string; description: string; confidence: number; rationale: string; suggestedModifiers?: string[] }>;
  } | null;

  @Column({ name: 'encounter_id', type: 'uuid', nullable: true })
  encounterId!: string | null;

  @Column({ name: 'superbill_id', type: 'uuid', nullable: true })
  superbillId!: string | null;

  @Column({ name: 'provider_notes', type: 'text', nullable: true })
  providerNotes!: string | null;

  @Column({ name: 'connection_quality', type: 'jsonb', nullable: true })
  connectionQuality!: {
    averageBitrate?: number;
    packetLossPercent?: number;
    ratings?: Array<{ userId: string; rating: number; feedback?: string }>;
  } | null;

  @Column({ name: 'metadata', type: 'jsonb', default: {} })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
