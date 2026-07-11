import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Superbill } from './superbill.entity';

export enum SuperbillPaymentType {
  COPAY = 'copay',
  INSURANCE_PAYMENT = 'insurance_payment',
  WRITE_OFF = 'write_off',
  ADJUSTMENT = 'adjustment',
}

@Entity('superbill_payments')
export class SuperbillPayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: SuperbillPaymentType })
  type: SuperbillPaymentType;

  @Column('decimal', { precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'date', nullable: true })
  date: Date;

  @Column({ type: 'text', nullable: true })
  note: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  source: string;

  @Column()
  superbillId: string;

  @ManyToOne(() => Superbill, (superbill) => superbill.payments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'superbillId' })
  superbill: Superbill;

  @CreateDateColumn()
  createdAt: Date;
}
