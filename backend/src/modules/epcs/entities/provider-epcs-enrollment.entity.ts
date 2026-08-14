import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type EpcsEnrollmentStatus =
  | 'pending'
  | 'identity_proofing'
  | 'two_factor_setup'
  | 'access_control_pending'
  | 'active'
  | 'suspended'
  | 'revoked';

export type TwoFactorMethod = 'totp' | 'hard_token' | 'biometric' | 'push';

export type IdentityProofingStatus =
  | 'not_started'
  | 'in_progress'
  | 'verified'
  | 'failed'
  | 'expired';

@Entity('epcs_provider_enrollments')
@Index(['tenantId', 'userId'], { unique: true })
@Index(['tenantId', 'status'])
export class ProviderEpcsEnrollment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'user_name', type: 'varchar', length: 200 })
  userName!: string;

  // ── DEA & NPI ──────────────────────────────────────────────────────────
  @Column({ name: 'dea_number', type: 'varchar', length: 20 })
  deaNumber!: string;

  @Column({ name: 'npi_number', type: 'varchar', length: 20 })
  npiNumber!: string;

  @Column({ name: 'state_license', type: 'varchar', length: 50, nullable: true })
  stateLicense!: string | null;

  @Column({ name: 'practice_state', type: 'varchar', length: 2, nullable: true })
  practiceState!: string | null;

  // ── Identity Proofing (NIST 800-63-3 IAL2) ────────────────────────────
  @Column({
    name: 'identity_proofing_status',
    type: 'varchar',
    length: 30,
    default: 'not_started',
  })
  identityProofingStatus!: IdentityProofingStatus;

  @Column({ name: 'identity_proofed_at', type: 'timestamptz', nullable: true })
  identityProofedAt!: Date | null;

  @Column({ name: 'identity_proofed_by', type: 'uuid', nullable: true })
  identityProofedBy!: string | null;

  @Column({ name: 'identity_proofing_method', type: 'varchar', length: 50, nullable: true })
  identityProofingMethod!: string | null;

  // ── Two-Factor Authentication ─────────────────────────────────────────
  @Column({
    name: 'two_factor_method',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  twoFactorMethod!: TwoFactorMethod | null;

  @Column({ name: 'two_factor_enrolled_at', type: 'timestamptz', nullable: true })
  twoFactorEnrolledAt!: Date | null;

  @Column({ name: 'two_factor_secret', type: 'varchar', length: 255, nullable: true, select: false })
  twoFactorSecret!: string | null;

  // ── Logical Access Controls (Two-Person Rule) ─────────────────────────
  @Column({ name: 'access_control_granted', type: 'boolean', default: false })
  accessControlGranted!: boolean;

  @Column({ name: 'access_control_granted_by', type: 'uuid', nullable: true })
  accessControlGrantedBy!: string | null;

  @Column({ name: 'access_control_granted_by_name', type: 'varchar', length: 200, nullable: true })
  accessControlGrantedByName!: string | null;

  @Column({ name: 'access_control_granted_at', type: 'timestamptz', nullable: true })
  accessControlGrantedAt!: Date | null;

  // ── Enrollment Status ─────────────────────────────────────────────────
  @Column({
    name: 'status',
    type: 'varchar',
    length: 30,
    default: 'pending',
  })
  status!: EpcsEnrollmentStatus;

  @Column({ name: 'suspended_reason', type: 'text', nullable: true })
  suspendedReason!: string | null;

  @Column({ name: 'suspended_at', type: 'timestamptz', nullable: true })
  suspendedAt!: Date | null;

  // ── Surescripts SPI ───────────────────────────────────────────────────
  @Column({ name: 'surescripts_spi', type: 'varchar', length: 50, nullable: true })
  sureScriptsSpi!: string | null;

  // ── Audit ─────────────────────────────────────────────────────────────
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  /** Convenience getter — is this provider fully cleared to prescribe CS? */
  get isEpcsReady(): boolean {
    return (
      this.status === 'active' &&
      this.identityProofingStatus === 'verified' &&
      this.accessControlGranted &&
      !!this.twoFactorMethod
    );
  }
}
