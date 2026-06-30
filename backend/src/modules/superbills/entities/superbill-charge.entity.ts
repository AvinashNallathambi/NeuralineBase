import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Superbill } from './superbill.entity';

export enum ChargeType {
  SERVICE = 'service',
  SUPPLY = 'supply',
  EQUIPMENT = 'equipment',
  OTHER = 'other',
}

@Entity('superbill_charges')
export class SuperbillCharge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  description: string;

  @Column('decimal', { precision: 10, scale: 2 })
  amount: number;

  @Column({
    type: 'enum',
    enum: ChargeType,
    default: ChargeType.SERVICE,
  })
  type: ChargeType;

  @Column({ default: false })
  taxable: boolean;

  @ManyToOne(() => Superbill, (superbill) => superbill.charges, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'superbillId' })
  superbill: Superbill;

  @Column()
  superbillId: string;
}
