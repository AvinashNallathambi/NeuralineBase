import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';

/**
 * Source of the medication record.
 * - `prescription`: Derived from an e-prescription in the prescriptions table
 * - `patient_reported`: Patient/caregiver reported (OTC, supplements, herbal, outside provider)
 * - `pbm_history`: Downloaded from pharmacy benefit manager (Surescripts)
 * - `encounter`: Documented during an encounter but not formally prescribed
 */
export type MedicationSource = 'prescription' | 'patient_reported' | 'pbm_history' | 'encounter';

/**
 * Taking status — tracks what the patient is actually doing, not just what was prescribed.
 * Matches Epic's "Taking As Prescribed" / "Taking Differently" / "Not Taking" model.
 */
export type TakingStatus = 'taking' | 'taking_differently' | 'not_taking' | 'unknown' | 'completed';

export type MedicationStatus = 'active' | 'inactive' | 'discontinued' | 'completed';

@Entity('patient_medications')
@Index(['tenantId', 'patientId'])
@Index(['tenantId', 'patientId', 'status'])
@Index(['tenantId', 'patientId', 'source'])
export class PatientMedication {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'patient_id', type: 'varchar', length: 100 })
  patientId!: string;

  @Column({ name: 'patient_name', type: 'varchar', length: 200 })
  patientName!: string;

  /** Medication name (drug name + strength, e.g. "Lisinopril 10mg") */
  @Column({ name: 'medication_name', type: 'varchar', length: 255 })
  medicationName!: string;

  /** RxNorm code if known */
  @Column({ name: 'rx_norm_code', type: 'varchar', length: 20, nullable: true })
  rxNormCode!: string | null;

  /** Dosage (e.g. "10mg") */
  @Column({ name: 'dosage', type: 'varchar', length: 100, nullable: true })
  dosage!: string | null;

  /** Frequency (e.g. "Once daily", "BID", "PRN") */
  @Column({ name: 'frequency', type: 'varchar', length: 100, nullable: true })
  frequency!: string | null;

  /** Route (e.g. "Oral", "Topical", "IV") */
  @Column({ name: 'route', type: 'varchar', length: 50, nullable: true })
  route!: string | null;

  /** Duration (e.g. "30 days", "Ongoing") */
  @Column({ name: 'duration', type: 'varchar', length: 100, nullable: true })
  duration!: string | null;

  /** Instructions / SIG (e.g. "Take 1 tablet by mouth every morning") */
  @Column({ name: 'instructions', type: 'text', nullable: true })
  instructions!: string | null;

  /** Where this medication record came from */
  @Column({ name: 'source', type: 'varchar', length: 30, default: 'patient_reported' })
  source!: MedicationSource;

  /** What the patient is actually doing with this medication */
  @Column({ name: 'taking_status', type: 'varchar', length: 30, default: 'taking' })
  takingStatus!: TakingStatus;

  /** Overall medication status */
  @Column({ name: 'status', type: 'varchar', length: 20, default: 'active' })
  status!: MedicationStatus;

  /** When the patient started taking this medication */
  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate!: Date | null;

  /** When the patient stopped taking this medication */
  @Column({ name: 'stop_date', type: 'date', nullable: true })
  stopDate!: Date | null;

  /** Notes about how the patient is taking it differently from prescribed */
  @Column({ name: 'taking_notes', type: 'text', nullable: true })
  takingNotes!: string | null;

  /** Link to the originating prescription if source = 'prescription' */
  @Column({ name: 'prescription_id', type: 'uuid', nullable: true })
  prescriptionId!: string | null;

  /** Link to the originating encounter if source = 'encounter' */
  @Column({ name: 'encounter_id', type: 'varchar', length: 100, nullable: true })
  encounterId!: string | null;

  /** Provider who prescribed or documented this medication */
  @Column({ name: 'provider_id', type: 'varchar', length: 100, nullable: true })
  providerId!: string | null;

  @Column({ name: 'provider_name', type: 'varchar', length: 200, nullable: true })
  providerName!: string | null;

  /** Who reported this medication (patient name, caregiver, etc.) */
  @Column({ name: 'reported_by', type: 'varchar', length: 200, nullable: true })
  reportedBy!: string | null;

  /** PBM source name if source = 'pbm_history' */
  @Column({ name: 'pbm_source', type: 'varchar', length: 100, nullable: true })
  pbmSource!: string | null;

  /** General notes */
  @Column({ name: 'notes', type: 'text', nullable: true })
  notes!: string | null;

  /** Whether this medication has been reviewed during medication reconciliation */
  @Column({ name: 'is_reviewed', type: 'boolean', default: false })
  isReviewed!: boolean;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt!: Date | null;

  @Column({ name: 'reviewed_by', type: 'varchar', length: 100, nullable: true })
  reviewedBy!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
