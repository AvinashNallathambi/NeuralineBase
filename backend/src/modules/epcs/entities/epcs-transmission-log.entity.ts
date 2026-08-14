import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type TransmissionStatus =
  | 'pending'
  | 'transmitted'
  | 'delivered'
  | 'confirmed'
  | 'rejected'
  | 'error'
  | 'cancelled';

@Entity('epcs_transmission_logs')
@Index(['tenantId', 'prescriptionId'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'transmissionId'], { unique: true })
export class EpcsTransmissionLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'prescription_id', type: 'uuid' })
  prescriptionId!: string;

  // ── Transmission Details ───────────────────────────────────────────────
  /** Unique transmission ID (NCPDP message ID) */
  @Column({ name: 'transmission_id', type: 'varchar', length: 100 })
  transmissionId!: string;

  /** NCPDP SCRIPT message type: NewRx, CancelRx, RxChange */
  @Column({ name: 'message_type', type: 'varchar', length: 20, default: 'NewRx' })
  messageType!: string;

  @Column({
    name: 'status',
    type: 'varchar',
    length: 20,
    default: 'pending',
  })
  status!: TransmissionStatus;

  // ── Pharmacy ───────────────────────────────────────────────────────────
  @Column({ name: 'pharmacy_ncpdp', type: 'varchar', length: 20, nullable: true })
  pharmacyNcpdp!: string | null;

  @Column({ name: 'pharmacy_name', type: 'varchar', length: 255, nullable: true })
  pharmacyName!: string | null;

  @Column({ name: 'pharmacy_phone', type: 'varchar', length: 20, nullable: true })
  pharmacyPhone!: string | null;

  // ── Prescriber ─────────────────────────────────────────────────────────
  @Column({ name: 'prescriber_dea', type: 'varchar', length: 20, nullable: true })
  prescriberDea!: string | null;

  @Column({ name: 'prescriber_npi', type: 'varchar', length: 20, nullable: true })
  prescriberNpi!: string | null;

  @Column({ name: 'prescriber_spi', type: 'varchar', length: 50, nullable: true })
  prescriberSpi!: string | null;

  // ── Signing ────────────────────────────────────────────────────────────
  @Column({ name: 'signature_method', type: 'varchar', length: 20, nullable: true })
  signatureMethod!: string | null;

  @Column({ name: 'signed_at', type: 'timestamptz', nullable: true })
  signedAt!: Date | null;

  // ── Response ───────────────────────────────────────────────────────────
  @Column({ name: 'response_code', type: 'varchar', length: 10, nullable: true })
  responseCode!: string | null;

  @Column({ name: 'response_message', type: 'text', nullable: true })
  responseMessage!: string | null;

  @Column({ name: 'transmitted_at', type: 'timestamptz', nullable: true })
  transmittedAt!: Date | null;

  @Column({ name: 'confirmed_at', type: 'timestamptz', nullable: true })
  confirmedAt!: Date | null;

  @Column({ name: 'retry_count', type: 'int', default: 0 })
  retryCount!: number;

  @Column({ name: 'error_details', type: 'text', nullable: true })
  errorDetails!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
