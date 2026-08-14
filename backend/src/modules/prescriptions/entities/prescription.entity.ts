import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';

export type DeaSchedule = 'II' | 'III' | 'IV' | 'V';

export interface PrescriptionItemData {
  id: string;
  medication: string;
  rxNormCode?: string;
  /** DEA schedule if this medication is a controlled substance */
  deaSchedule?: DeaSchedule;
  /** Whether this medication is a controlled substance */
  isControlledSubstance?: boolean;
  dosage: string;
  frequency: string;
  route: string;
  duration: string;
  quantity: number;
  refills: number;
  instructions?: string;
}

@Entity('prescriptions')
@Index(['tenantId', 'patientId'])
@Index(['tenantId', 'providerId'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'prescribedDate'])
export class Prescription {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'patient_id', type: 'varchar', length: 100 })
  patientId!: string;

  @Column({ name: 'patient_name', type: 'varchar', length: 200 })
  patientName!: string;

  @Column({ name: 'provider_id', type: 'varchar', length: 100 })
  providerId!: string;

  @Column({ name: 'provider_name', type: 'varchar', length: 200 })
  providerName!: string;

  @Column({ name: 'encounter_id', type: 'varchar', length: 100, nullable: true })
  encounterId!: string | null;

  @Column({ name: 'medications', type: 'jsonb' })
  medications!: PrescriptionItemData[];

  @Column({
    name: 'status',
    type: 'varchar',
    length: 20,
    default: 'draft',
  })
  status!: string;

  @Column({ name: 'prescribed_date', type: 'date', nullable: true })
  prescribedDate!: Date | null;

  @Column({ name: 'pharmacy', type: 'varchar', length: 255, nullable: true })
  pharmacy!: string | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes!: string | null;

  // ── EPCS Fields (Electronic Prescribing of Controlled Substances) ──────
  /** Whether this prescription contains any controlled substances */
  @Column({ name: 'is_controlled_substance', type: 'boolean', default: false })
  isControlledSubstance!: boolean;

  /** Highest DEA schedule across all medications (II is highest) */
  @Column({ name: 'dea_schedule', type: 'varchar', length: 5, nullable: true })
  deaSchedule!: string | null;

  /** Prescriber's DEA number (for CS prescriptions) */
  @Column({ name: 'prescriber_dea_number', type: 'varchar', length: 20, nullable: true })
  prescriberDeaNumber!: string | null;

  /** Prescriber's NPI */
  @Column({ name: 'prescriber_npi', type: 'varchar', length: 20, nullable: true })
  prescriberNpi!: string | null;

  /** Method used to sign: 'totp' | 'hard_token' | 'biometric' | 'push' */
  @Column({ name: 'epcs_signature_method', type: 'varchar', length: 20, nullable: true })
  epcsSignatureMethod!: string | null;

  /** When the prescription was digitally signed (EPCS) */
  @Column({ name: 'epcs_signed_at', type: 'timestamptz', nullable: true })
  epcsSignedAt!: Date | null;

  /** Who signed (user ID — must be the prescriber, not a delegate) */
  @Column({ name: 'epcs_signed_by', type: 'uuid', nullable: true })
  epcsSignedBy!: string | null;

  /** Transmission status for EPCS: 'not_transmitted' | 'pending' | 'transmitted' | 'delivered' | 'confirmed' | 'rejected' | 'error' */
  @Column({ name: 'epcs_transmission_status', type: 'varchar', length: 20, default: 'not_transmitted' })
  epcsTransmissionStatus!: string;

  /** Surescripts/NCPDP transmission ID */
  @Column({ name: 'epcs_transmission_id', type: 'varchar', length: 100, nullable: true })
  epcsTransmissionId!: string | null;

  /** Pharmacy NCPDP ID (for EPCS transmission) */
  @Column({ name: 'pharmacy_ncpdp', type: 'varchar', length: 20, nullable: true })
  pharmacyNcpdp!: string | null;

  /** PDMP query ID associated with this prescription */
  @Column({ name: 'pdmp_query_id', type: 'uuid', nullable: true })
  pdmpQueryId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
