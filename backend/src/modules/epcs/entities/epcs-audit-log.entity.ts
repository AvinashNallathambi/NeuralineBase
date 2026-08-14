import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * EPCS Audit Log — immutable, tamper-evident audit trail required by
 * 21 CFR 1311.300(e).
 *
 * Each entry is cryptographically chained to the previous entry via
 * `previousHash`. The `entryHash` is SHA-256 of all fields including
 * `previousHash`, making any tampering detectable.
 *
 * Records MUST NEVER be updated or deleted.
 */
@Entity('epcs_audit_logs')
@Index(['tenantId', 'createdAt'])
@Index(['tenantId', 'prescriptionId'])
@Index(['tenantId', 'userId'])
@Index(['tenantId', 'action'])
export class EpcsAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  // ── Action Details ────────────────────────────────────────────────────
  /**
   * EPCS action type:
   * - enrollment_started, identity_proofing_passed, identity_proofing_failed
   * - two_factor_setup, two_factor_verified, two_factor_failed
   * - access_control_granted, access_control_revoked
   * - prescription_created, prescription_reviewed, prescription_signed
   * - prescription_transmitted, transmission_confirmed, transmission_failed
   * - prescription_cancelled, prescription_modified
   * - enrollment_suspended, enrollment_revoked, enrollment_reactivated
   */
  @Column({ name: 'action', type: 'varchar', length: 50 })
  action!: string;

  @Column({ name: 'prescription_id', type: 'uuid', nullable: true })
  prescriptionId!: string | null;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId!: string | null;

  @Column({ name: 'user_name', type: 'varchar', length: 200, nullable: true })
  userName!: string | null;

  @Column({ name: 'user_role', type: 'varchar', length: 50, nullable: true })
  userRole!: string | null;

  @Column({ name: 'patient_id', type: 'varchar', length: 100, nullable: true })
  patientId!: string | null;

  @Column({ name: 'patient_name', type: 'varchar', length: 200, nullable: true })
  patientName!: string | null;

  @Column({ name: 'medication', type: 'varchar', length: 255, nullable: true })
  medication!: string | null;

  @Column({ name: 'dea_schedule', type: 'varchar', length: 5, nullable: true })
  deaSchedule!: string | null;

  @Column({ name: 'quantity', type: 'int', nullable: true })
  quantity!: number | null;

  // ── Two-Factor Authentication Details ──────────────────────────────────
  @Column({ name: 'two_factor_method', type: 'varchar', length: 20, nullable: true })
  twoFactorMethod!: string | null;

  @Column({ name: 'two_factor_success', type: 'boolean', nullable: true })
  twoFactorSuccess!: boolean | null;

  // ── Transmission Details ───────────────────────────────────────────────
  @Column({ name: 'transmission_id', type: 'varchar', length: 100, nullable: true })
  transmissionId!: string | null;

  @Column({ name: 'pharmacy_ncpdp', type: 'varchar', length: 20, nullable: true })
  pharmacyNcpdp!: string | null;

  @Column({ name: 'pharmacy_name', type: 'varchar', length: 255, nullable: true })
  pharmacyName!: string | null;

  // ── Cryptographic Chain ────────────────────────────────────────────────
  /** SHA-256 hash of the previous audit entry — creates a tamper-evident chain */
  @Column({ name: 'previous_hash', type: 'varchar', length: 64, nullable: true })
  previousHash!: string | null;

  /** SHA-256 hash of this entry (all fields + previousHash) */
  @Column({ name: 'entry_hash', type: 'varchar', length: 64 })
  entryHash!: string;

  // ── Context ────────────────────────────────────────────────────────────
  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress!: string | null;

  @Column({ name: 'user_agent', type: 'varchar', length: 500, nullable: true })
  userAgent!: string | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'metadata', type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
