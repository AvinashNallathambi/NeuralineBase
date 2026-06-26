import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * HIPAA Patient Consent Tracking
 *
 * Tracks patient authorization for use and disclosure of PHI
 * as required by 45 CFR 164.508.
 *
 * Each record represents one consent grant or revocation.
 * Records are append-only – revocations create a new row
 * with status='revoked' rather than updating the original.
 */
@Entity('patient_consents')
@Index(['tenantId', 'patientId'])
@Index(['patientId', 'consentType'])
@Index(['status'])
export class PatientConsent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId!: string;

  /**
   * Type of consent:
   *   - treatment:     consent for treatment
   *   - payment:       consent to share PHI for payment
   *   - operations:    consent to share PHI for healthcare operations
   *   - research:      consent for research use
   *   - marketing:     consent for marketing communications
   *   - data_sharing:  consent to share with a specific third party
   *   - telehealth:    consent for telehealth services
   */
  @Column({ name: 'consent_type', type: 'varchar', length: 50 })
  consentType!: string;

  /** 'granted' | 'revoked' | 'expired' */
  @Column({ name: 'status', type: 'varchar', length: 20, default: 'granted' })
  status!: string;

  /** Date consent was given. */
  @Column({ name: 'granted_at', type: 'timestamptz' })
  grantedAt!: Date;

  /** Date consent expires (null = no expiration). */
  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  /** Date consent was revoked (null = still active). */
  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  /** Method of consent capture (e.g. 'electronic', 'paper', 'verbal'). */
  @Column({ name: 'capture_method', type: 'varchar', length: 30, default: 'electronic' })
  captureMethod!: string;

  /** Free-text description of what is being consented to. */
  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string | null;

  /** ID of the user who recorded the consent. */
  @Column({ name: 'recorded_by', type: 'uuid', nullable: true })
  recordedBy!: string | null;

  /** IP address from which consent was captured (for electronic consent). */
  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress!: string | null;

  /** Version of the consent form presented. */
  @Column({ name: 'form_version', type: 'varchar', length: 20, nullable: true })
  formVersion!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
