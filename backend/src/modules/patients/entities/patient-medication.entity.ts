import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';

/** Where the medication entry came from */
export enum PatientMedicationSource {
  PRESCRIBED = 'prescribed',
  PATIENT_REPORTED = 'patient_reported',
  OTC = 'otc',
  SUPPLEMENT = 'supplement',
  EXTERNAL = 'external',
}

/** Clinical lifecycle status of the medication */
export enum PatientMedicationStatus {
  ACTIVE = 'active',
  ON_HOLD = 'on_hold',
  DISCONTINUED = 'discontinued',
  COMPLETED = 'completed',
}

/** Whether the patient is actually taking the medication (medication reconciliation) */
export enum PatientMedicationTakingStatus {
  TAKING = 'taking',
  NOT_TAKING = 'not_taking',
  AS_NEEDED = 'as_needed',
  UNKNOWN = 'unknown',
}

/**
 * A patient's medication list entry — the clinical "what is this patient on"
 * view used for review and reconciliation. Includes prescribed medications
 * (synced from prescriptions/encounters) as well as patient-reported,
 * over-the-counter, and supplement entries that never go through the
 * e-prescribing workflow.
 */
@Entity('patient_medications')
@Index(['tenantId', 'patientId'])
@Index(['tenantId', 'patientId', 'status'])
@Index(['tenantId', 'encounterId'])
export class PatientMedication {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId!: string;

  @Column({ name: 'name', type: 'varchar', length: 255 })
  name!: string;

  @Column({ name: 'rxnorm_code', type: 'varchar', length: 50, nullable: true })
  rxNormCode!: string | null;

  @Column({ name: 'dosage', type: 'varchar', length: 100, nullable: true })
  dosage!: string | null;

  @Column({ name: 'frequency', type: 'varchar', length: 100, nullable: true })
  frequency!: string | null;

  @Column({ name: 'route', type: 'varchar', length: 50, nullable: true })
  route!: string | null;

  @Column({
    name: 'source',
    type: 'varchar',
    length: 20,
    default: PatientMedicationSource.PRESCRIBED,
  })
  source!: PatientMedicationSource;

  @Column({
    name: 'status',
    type: 'varchar',
    length: 20,
    default: PatientMedicationStatus.ACTIVE,
  })
  status!: PatientMedicationStatus;

  @Column({
    name: 'taking_status',
    type: 'varchar',
    length: 20,
    default: PatientMedicationTakingStatus.TAKING,
  })
  takingStatus!: PatientMedicationTakingStatus;

  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate!: Date | null;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate!: Date | null;

  /** Link back to the prescription that generated this entry (if prescribed) */
  @Column({ name: 'prescription_id', type: 'uuid', nullable: true })
  prescriptionId!: string | null;

  /** Encounter that originated this entry (for encounter sync dedup) */
  @Column({ name: 'encounter_id', type: 'varchar', length: 100, nullable: true })
  encounterId!: string | null;

  @Column({ name: 'prescriber_name', type: 'varchar', length: 200, nullable: true })
  prescriberName!: string | null;

  @Column({ name: 'indication', type: 'varchar', length: 255, nullable: true })
  indication!: string | null;

  @Column({ name: 'instructions', type: 'text', nullable: true })
  instructions!: string | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes!: string | null;

  /** Reason the medication was discontinued */
  @Column({ name: 'discontinued_reason', type: 'text', nullable: true })
  discontinuedReason!: string | null;

  /** Staff user who recorded/last reconciled this entry */
  @Column({ name: 'recorded_by', type: 'varchar', length: 100, nullable: true })
  recordedBy!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
