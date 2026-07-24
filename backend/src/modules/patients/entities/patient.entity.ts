import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
  Index,
} from 'typeorm';

// Forward-reference interfaces for relations (actual entities in their own modules)
// import { Allergy } from '../../clinical/entities/allergy.entity';
// import { Encounter } from '../../clinical/entities/encounter.entity';
// import { Appointment } from '../../appointments/entities/appointment.entity';

@Entity('patients')
@Index(['tenantId', 'mrn'], { unique: true })
@Index(['tenantId', 'lastName', 'firstName'])
@Index(['tenantId', 'email'])
@Index(['tenantId', 'phone'])
@Index(['tenantId', 'status'])
export class Patient {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'mrn', type: 'varchar', length: 50, nullable: true })
  mrn!: string | null;

  @Column({ name: 'first_name', type: 'varchar', length: 100 })
  firstName!: string;

  @Column({ name: 'last_name', type: 'varchar', length: 100 })
  lastName!: string;

  @Column({ name: 'date_of_birth', type: 'date' })
  dateOfBirth!: Date;

  @Column({
    name: 'gender',
    type: 'varchar',
    length: 20,
  })
  gender!: string;

  @Column({ name: 'email', type: 'varchar', length: 255, nullable: true })
  email!: string | null;

  @Column({ name: 'phone', type: 'varchar', length: 20, nullable: true })
  phone!: string | null;

  // ─── Patient Portal Auth Fields ─────────────────────────────────
  @Column({ name: 'password_hash', type: 'varchar', length: 255, nullable: true })
  passwordHash!: string | null;

  @Column({ name: 'mfa_enabled', type: 'boolean', default: false })
  mfaEnabled!: boolean;

  @Column({ name: 'mfa_secret', type: 'varchar', length: 255, nullable: true })
  mfaSecret!: string | null;

  @Column({ name: 'portal_active', type: 'boolean', default: false })
  portalActive!: boolean;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt!: Date | null;

  @Column({ name: 'password_reset_token', type: 'varchar', length: 255, nullable: true })
  passwordResetToken!: string | null;

  @Column({ name: 'password_reset_expires_at', type: 'timestamptz', nullable: true })
  passwordResetExpiresAt!: Date | null;

  // ─── Portal Admin / Invitation Fields ────────────────────────────
  // One-time token issued by an admin when enabling portal access.
  // The patient must present this token (plus their tenantId) to
  // `POST /patients/auth/:patientId/setup-account` in order to set
  // their initial password. Null once the account has been set up or
  // if portal access has been disabled.
  @Column({ name: 'portal_invitation_token', type: 'varchar', length: 255, nullable: true })
  portalInvitationToken!: string | null;

  @Column({ name: 'portal_invitation_expires_at', type: 'timestamptz', nullable: true })
  portalInvitationExpiresAt!: Date | null;

  @Column({ name: 'address', type: 'jsonb', nullable: true })
  address!: {
    street1: string;
    street2?: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  } | null;

  @Column({ name: 'emergency_contact', type: 'jsonb', nullable: true })
  emergencyContact!: {
    name: string;
    relationship: string;
    phone: string;
    email?: string;
  } | null;

  @Column({
    name: 'blood_type',
    type: 'varchar',
    length: 5,
    nullable: true,
  })
  bloodType!: string | null;

  @Column({
    name: 'status',
    type: 'varchar',
    length: 20,
    default: 'active',
  })
  status!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  // ─── Relations ──────────────────────────────────────────────────

  @OneToMany('PatientInsurance', 'patient')
  insurances!: unknown[];

  @OneToMany('Encounter', 'patient')
  encounters!: unknown[];

  @OneToMany('PatientProblem', 'patient')
  problems!: unknown[];

  // TODO: Uncomment when Allergy entity is created
  // @OneToMany(() => Allergy, (allergy) => allergy.patient)
  // allergies!: Allergy[];

  // TODO: Uncomment when Appointment entity is created
  // @OneToMany(() => Appointment, (appointment) => appointment.patient)
  // appointments!: Appointment[];

  // Placeholder relation arrays for TypeORM eager loading
  allergies?: unknown[];
  appointments?: unknown[];
}
