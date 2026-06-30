import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Superbill } from './superbill.entity';

export enum DiagnosisType {
  PRIMARY = 'primary',
  SECONDARY = 'secondary',
  ADMITTING = 'admitting',
  WORKING = 'working',
}

@Entity('superbill_diagnoses')
export class SuperbillDiagnosis {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  icdCode: string;

  @Column()
  description: string;

  @Column({
    type: 'enum',
    enum: DiagnosisType,
    default: DiagnosisType.PRIMARY,
  })
  type: DiagnosisType;

  @ManyToOne(() => Superbill, (superbill) => superbill.diagnoses, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'superbillId' })
  superbill: Superbill;

  @Column()
  superbillId: string;
}
