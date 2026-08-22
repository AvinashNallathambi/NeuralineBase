import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Patient } from '../../patients/entities/patient.entity';

export type ImmunizationStatus = 'completed' | 'entered-in-error' | 'not-done';
export type ImmunizationSource = 'administered' | 'historical' | 'registry' | 'patient_reported';

@Entity('patient_immunizations')
@Index(['tenantId', 'patientId'])
@Index(['tenantId', 'patientId', 'cvxCode'])
export class PatientImmunization {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId!: string;

  /** Vaccine name (e.g. "Influenza, quadrivalent", "MMR", "Tdap") */
  @Column({ name: 'vaccine_name', type: 'varchar', length: 255 })
  vaccineName!: string;

  /** CVX (Clinical Vaccine) code — standard vaccine identifier */
  @Column({ name: 'cvx_code', type: 'varchar', length: 20, nullable: true })
  cvxCode!: string | null;

  /** CPT code for billing (e.g. 90686, 90715) */
  @Column({ name: 'cpt_code', type: 'varchar', length: 10, nullable: true })
  cptCode!: string | null;

  /** NDC (National Drug Code) for the specific product */
  @Column({ name: 'ndc_code', type: 'varchar', length: 20, nullable: true })
  ndcCode!: string | null;

  /** Manufacturer / brand name */
  @Column({ name: 'manufacturer', type: 'varchar', length: 200, nullable: true })
  manufacturer!: string | null;

  /** Lot number */
  @Column({ name: 'lot_number', type: 'varchar', length: 100, nullable: true })
  lotNumber!: string | null;

  /** Expiration date of the vaccine product */
  @Column({ name: 'expiration_date', type: 'date', nullable: true })
  expirationDate!: Date | null;

  /** Date the vaccine was administered */
  @Column({ name: 'administered_date', type: 'date' })
  administeredDate!: Date;

  /** Dose number in the series (1, 2, 3, booster, etc.) */
  @Column({ name: 'dose_number', type: 'int', nullable: true })
  doseNumber!: number | null;

  /** Dose amount (e.g. "0.5") */
  @Column({ name: 'dose_amount', type: 'varchar', length: 20, nullable: true })
  doseAmount!: string | null;

  /** Dose unit (e.g. "mL") */
  @Column({ name: 'dose_unit', type: 'varchar', length: 20, nullable: true })
  doseUnit!: string | null;

  /** Route of administration (oral, intramuscular, subcutaneous, intranasal, etc.) */
  @Column({ name: 'route', type: 'varchar', length: 50, nullable: true })
  route!: string | null;

  /** Anatomical site (left arm, right thigh, etc.) */
  @Column({ name: 'site', type: 'varchar', length: 50, nullable: true })
  site!: string | null;

  /** Status: completed, entered-in-error, not-done */
  @Column({ name: 'status', type: 'varchar', length: 20, default: 'completed' })
  status!: ImmunizationStatus;

  /** Source: administered in-clinic, historical, from registry, or patient-reported */
  @Column({ name: 'source', type: 'varchar', length: 30, default: 'administered' })
  source!: ImmunizationSource;

  /** Link to the encounter where it was administered (if applicable) */
  @Column({ name: 'encounter_id', type: 'varchar', length: 100, nullable: true })
  encounterId!: string | null;

  /** Provider who administered the vaccine */
  @Column({ name: 'provider_id', type: 'varchar', length: 100, nullable: true })
  providerId!: string | null;

  @Column({ name: 'provider_name', type: 'varchar', length: 200, nullable: true })
  providerName!: string | null;

  /** Facility where administered */
  @Column({ name: 'facility_name', type: 'varchar', length: 255, nullable: true })
  facilityName!: string | null;

  /** VIS (Vaccine Information Statement) edition date */
  @Column({ name: 'vis_date', type: 'date', nullable: true })
  visDate!: Date | null;

  /** VFC (Vaccines for Children) eligibility: VFC, private, state, other */
  @Column({ name: 'vfc_eligibility', type: 'varchar', length: 30, nullable: true })
  vfcEligibility!: string | null;

  /** Funding source: VFC, private, state, other */
  @Column({ name: 'funding_source', type: 'varchar', length: 30, nullable: true })
  fundingSource!: string | null;

  /** Reaction notes (if any adverse reaction occurred) */
  @Column({ name: 'reaction_notes', type: 'text', nullable: true })
  reactionNotes!: string | null;

  /** General notes */
  @Column({ name: 'notes', type: 'text', nullable: true })
  notes!: string | null;

  /** Recorded by (staff member who entered the record) */
  @Column({ name: 'recorded_by', type: 'varchar', length: 64, nullable: true })
  recordedBy!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient;
}
