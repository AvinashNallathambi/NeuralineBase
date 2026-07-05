import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';

@Entity('insurance_payers')
@Index(['tenantId', 'payerId', 'name'])
export class InsurancePayer {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  @Index()
  tenantId!: string;

  @Column({ name: 'payer_id', type: 'varchar', length: 50, unique: true })
  payerId!: string;

  @Column({ name: 'name', type: 'varchar', length: 255 })
  name!: string;

  @Column({ name: 'payer_type', type: 'varchar', length: 50, default: 'commercial' })
  payerType!: string;

  @Column({ name: 'address', type: 'jsonb', nullable: true })
  address!: {
    street1: string;
    street2?: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  } | null;

  @Column({ name: 'phone', type: 'varchar', length: 20, nullable: true })
  phone!: string | null;

  @Column({ name: 'email', type: 'varchar', length: 255, nullable: true })
  email!: string | null;

  @Column({ name: 'website', type: 'varchar', length: 255, nullable: true })
  website!: string | null;

  @Column({ name: 'electronic_claim_url', type: 'varchar', length: 255, nullable: true })
  electronicClaimUrl!: string | null;

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'active' })
  status!: string;

  @Column({ name: 'metadata', type: 'jsonb', default: {} })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
