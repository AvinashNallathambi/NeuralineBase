import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

export enum EncounterType {
  OFFICE_VISIT = 'office_visit',
  TELEHEALTH = 'telehealth',
  HOSPITAL = 'hospital',
  EMERGENCY = 'emergency',
  HOME_HEALTH = 'home_health',
  NURSING_FACILITY = 'nursing_facility',
}

export enum EncounterStatus {
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no_show',
}

@Entity('encounters')
@Index(['tenantId', 'patientId'])
@Index(['tenantId', 'providerId'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'type'])
@Index(['tenantId', 'startTime'])
export class Encounter {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  @Index()
  tenantId!: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  @Index()
  patientId!: string;

  @Column({ name: 'provider_id', type: 'uuid' })
  @Index()
  providerId!: string;

  @Column({ name: 'appointment_id', type: 'uuid', nullable: true })
  @Index()
  appointmentId!: string | null;

  @Column({ name: 'department_id', type: 'uuid', nullable: true })
  @Index()
  departmentId!: string | null;

  @Column({ name: 'clinical_template_id', type: 'uuid', nullable: true })
  @Index()
  clinicalTemplateId!: string | null;

  @Column({ name: 'location', type: 'varchar', length: 255, nullable: true })
  location!: string | null;

  @Column({ name: 'room', type: 'varchar', length: 100, nullable: true })
  room!: string | null;

  @Column({
    type: 'enum',
    enum: EncounterType,
    default: EncounterType.OFFICE_VISIT,
  })
  type!: EncounterType;

  @Column({
    type: 'enum',
    enum: EncounterStatus,
    default: EncounterStatus.SCHEDULED,
  })
  status!: EncounterStatus;

  @Column({ name: 'priority', type: 'varchar', length: 50, nullable: true })
  priority!: string | null;

  @Column({ name: 'visit_category', type: 'varchar', length: 100, nullable: true })
  visitCategory!: string | null;

  @Column({ name: 'visit_reason', type: 'text', nullable: true })
  visitReason!: string | null;

  @Column({ name: 'chief_complaint', type: 'text', nullable: true })
  chiefComplaint!: string | null;

  @Column({ name: 'arrival_time', type: 'timestamptz', nullable: true })
  arrivalTime!: Date | null;

  @Column({ name: 'start_time', type: 'timestamptz' })
  startTime!: Date;

  @Column({ name: 'end_time', type: 'timestamptz', nullable: true })
  endTime!: Date | null;

  @Column({ name: 'duration_minutes', type: 'int', nullable: true })
  durationMinutes!: number | null;

  @Column({ name: 'soap_note', type: 'jsonb', default: {} })
  soapNote!: {
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
  };

  @Column({ name: 'vitals', type: 'jsonb', default: {} })
  vitals!: {
    bloodPressure?: string;
    heartRate?: string;
    temperature?: string;
    temperatureRoute?: string;
    weight?: string;
    weightUnit?: string;
    height?: string;
    heightUnit?: string;
    bmi?: string;
    oxygenSaturation?: string;
    respiratoryRate?: string;
    painScore?: number;
    painLocation?: string;
    bloodGlucose?: string;
    bloodGlucoseContext?: string;
    headCircumference?: string;
    waistCircumference?: string;
    intraocularPressureLeft?: string;
    intraocularPressureRight?: string;
    recordedDate?: string;
    recordedBy?: string;
  };

  @Column({ name: 'diagnoses', type: 'jsonb', default: [] })
  diagnoses!: Array<{
    code: string;
    description: string;
    isPrimary: boolean;
    type?: 'chronic' | 'acute' | 'rule_out';
    status?: 'active' | 'resolved' | 'ruled_out';
    onsetDate?: string;
    resolvedDate?: string;
    notes?: string;
  }>;

  @Column({ name: 'treatment_plan', type: 'jsonb', default: {} })
  treatmentPlan!: {
    medications?: Array<{
      name: string;
      dosage: string;
      frequency: string;
      route?: string;
      duration?: string;
      refills?: number;
      instructions?: string;
      isNew?: boolean;
    }>;
    procedures?: Array<{
      name: string;
      cptCode?: string;
      description: string;
      status?: string;
    }>;
    followUp?: string;
    followUpDate?: string;
    followUpProviderId?: string;
    followUpProviderName?: string;
    referrals?: Array<{ specialty: string; provider?: string; reason: string; urgency?: string }>;
    goals?: string[];
    interventions?: string[];
    homeInstructions?: string;
    patientEducation?: string[];
    restrictions?: string;
    recallReminder?: string;
  };

  @Column({ name: 'allergies', type: 'jsonb', default: [] })
  allergies!: Array<{
    allergen: string;
    reaction: string;
    severity: 'mild' | 'moderate' | 'severe' | 'life_threatening';
    type?: 'drug' | 'food' | 'environmental' | 'other';
    onsetDate?: string;
    notes?: string;
  }>;

  @Column({ name: 'orders', type: 'jsonb', default: {} })
  orders!: {
    labs?: Array<{
      name: string;
      loincCode?: string;
      status: 'ordered' | 'collected' | 'resulted' | 'cancelled';
      priority?: 'routine' | 'stat' | 'asap';
      orderedDate: string;
      notes?: string;
    }>;
    imaging?: Array<{
      name: string;
      modality?: string;
      bodyPart?: string;
      status: 'ordered' | 'scheduled' | 'completed' | 'cancelled';
      priority?: 'routine' | 'stat' | 'asap';
      orderedDate: string;
      notes?: string;
    }>;
    referrals?: Array<{
      specialty: string;
      provider?: string;
      reason: string;
      urgency?: 'routine' | 'urgent' | 'emergent';
      status: 'pending' | 'sent' | 'scheduled' | 'completed' | 'cancelled';
      notes?: string;
    }>;
    procedures?: Array<{
      name: string;
      cptCode?: string;
      description: string;
      status: 'ordered' | 'scheduled' | 'completed' | 'cancelled';
      scheduledDate?: string;
      notes?: string;
    }>;
  };

  @Column({ name: 'attachments', type: 'jsonb', default: [] })
  attachments!: Array<{
    fileName: string;
    fileType: string;
    url: string;
    description?: string;
    category?: 'lab_result' | 'imaging' | 'consent' | 'referral' | 'other';
    uploadedAt: string;
    uploadedBy?: string;
  }>;

  @Column({ name: 'clinical_notes', type: 'text', nullable: true })
  clinicalNotes!: string | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'signed_at', type: 'timestamptz', nullable: true })
  signedAt!: Date | null;

  @Column({ name: 'signed_by', type: 'uuid', nullable: true })
  signedBy!: string | null;

  @Column({ name: 'locked_at', type: 'timestamptz', nullable: true })
  lockedAt!: Date | null;

  @Column({ name: 'locked_by', type: 'uuid', nullable: true })
  lockedBy!: string | null;

  @Column({ name: 'is_locked', type: 'boolean', default: false })
  isLocked!: boolean;

  @Column({ name: 'audit_trail', type: 'jsonb', default: [] })
  auditTrail!: Array<{
    action: string;
    performedBy: string;
    performedAt: string;
    note?: string;
    previousStatus?: string;
    newStatus?: string;
  }>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  @ManyToOne('Patient', 'encounters', {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'patient_id' })
  patient!: unknown;
}
