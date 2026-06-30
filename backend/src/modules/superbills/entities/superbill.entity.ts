import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { SuperbillDiagnosis } from './superbill-diagnosis.entity';
import { SuperbillProcedure } from './superbill-procedure.entity';
import { SuperbillCharge } from './superbill-charge.entity';

export enum SuperbillStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  PROCESSED = 'processed',
  PAID = 'paid',
  REJECTED = 'rejected',
}

@Entity('superbills')
export class Superbill {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  patientId: string;

  @Column()
  patientName: string;

  @Column()
  patientDOB: string;

  @Column('jsonb')
  patientAddress: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };

  @Column()
  patientPhone: string;

  @Column()
  providerId: string;

  @Column()
  providerName: string;

  @Column()
  providerNPI: string;

  @Column('jsonb')
  providerAddress: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };

  @Column({ nullable: true })
  encounterId: string;

  @Column()
  serviceDate: Date;

  @Column({ nullable: true })
  submissionDate: Date;

  @Column({
    type: 'enum',
    enum: SuperbillStatus,
    default: SuperbillStatus.DRAFT,
  })
  status: SuperbillStatus;

  @Column('jsonb')
  insurance: {
    provider: string;
    policyNumber: string;
    groupNumber: string;
    subscriberName: string;
    subscriberRelation: string;
    payerId: string;
    authorizationNumber?: string;
  };

  @OneToMany(() => SuperbillDiagnosis, (diagnosis) => diagnosis.superbill, {
    cascade: true,
    eager: true,
  })
  diagnoses: SuperbillDiagnosis[];

  @OneToMany(() => SuperbillProcedure, (procedure) => procedure.superbill, {
    cascade: true,
    eager: true,
  })
  procedures: SuperbillProcedure[];

  @OneToMany(() => SuperbillCharge, (charge) => charge.superbill, {
    cascade: true,
    eager: true,
  })
  charges: SuperbillCharge[];

  @Column('decimal', { precision: 10, scale: 2 })
  totalAmount: number;

  @Column('decimal', { precision: 10, scale: 2 })
  patientResponsibility: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  insurancePayment: number;

  @Column({ nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
