import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Superbill } from './superbill.entity';

@Entity('superbill_procedures')
export class SuperbillProcedure {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  cptCode: string;

  @Column()
  description: string;

  @Column('simple-array', { nullable: true })
  modifiers: string[];

  @Column('int')
  units: number;

  @Column('decimal', { precision: 10, scale: 2 })
  charge: number;

  @Column()
  serviceDate: Date;

  @Column('simple-array')
  diagnosisPointer: string[]; // ICD codes this procedure links to

  @ManyToOne(() => Superbill, (superbill) => superbill.procedures, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'superbillId' })
  superbill: Superbill;

  @Column()
  superbillId: string;
}
