import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('vaccine_inventory')
@Index(['tenantId', 'vaccineName'])
@Index(['tenantId', 'lotNumber'])
@Index(['tenantId', 'fundingSource'])
export class VaccineInventory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'vaccine_name', type: 'varchar', length: 255 })
  vaccineName!: string;

  @Column({ name: 'cvx_code', type: 'varchar', length: 10, nullable: true })
  cvxCode!: string | null;

  @Column({ name: 'ndc_code', type: 'varchar', length: 20, nullable: true })
  ndcCode!: string | null;

  @Column({ name: 'manufacturer', type: 'varchar', length: 255, nullable: true })
  manufacturer!: string | null;

  @Column({ name: 'lot_number', type: 'varchar', length: 100 })
  lotNumber!: string;

  @Column({ name: 'expiration_date', type: 'date' })
  expirationDate!: Date;

  @Column({ name: 'quantity_on_hand', type: 'int', default: 0 })
  quantityOnHand!: number;

  @Column({ name: 'quantity_administered', type: 'int', default: 0 })
  quantityAdministered!: number;

  @Column({ name: 'quantity_received', type: 'int', default: 0 })
  quantityReceived!: number;

  @Column({
    name: 'funding_source',
    type: 'varchar',
    length: 20,
    default: 'private',
  })
  fundingSource!: 'vfc' | 'private' | 'state' | 'section317';

  @Column({
    name: 'vfc_eligibility',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  vfcEligibility!: string | null;

  @Column({ name: 'storage_location', type: 'varchar', length: 100, nullable: true })
  storageLocation!: string | null;

  @Column({ name: 'storage_temp_min', type: 'float', nullable: true })
  storageTempMin!: number | null;

  @Column({ name: 'storage_temp_max', type: 'float', nullable: true })
  storageTempMax!: number | null;

  @Column({
    name: 'status',
    type: 'varchar',
    length: 20,
    default: 'available',
  })
  status!: 'available' | 'depleted' | 'expired' | 'recalled' | 'quarantined';

  @Column({ name: 'received_date', type: 'date', nullable: true })
  receivedDate!: Date | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
