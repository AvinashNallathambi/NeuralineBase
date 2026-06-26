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
// import { Insurance } from '../../insurances/entities/insurance.entity';
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

  // TODO: Uncomment when Insurance entity is created
  // @OneToMany(() => Insurance, (insurance) => insurance.patient)
  // insurances!: Insurance[];

  // TODO: Uncomment when Allergy entity is created
  // @OneToMany(() => Allergy, (allergy) => allergy.patient)
  // allergies!: Allergy[];

  // TODO: Uncomment when Encounter entity is created
  // @OneToMany(() => Encounter, (encounter) => encounter.patient)
  // encounters!: Encounter[];

  // TODO: Uncomment when Appointment entity is created
  // @OneToMany(() => Appointment, (appointment) => appointment.patient)
  // appointments!: Appointment[];

  // Placeholder relation arrays for TypeORM eager loading
  insurances?: unknown[];
  allergies?: unknown[];
  encounters?: unknown[];
  appointments?: unknown[];
}
