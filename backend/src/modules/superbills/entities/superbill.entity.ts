import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { SuperbillDiagnosis } from './superbill-diagnosis.entity';
import { SuperbillProcedure } from './superbill-procedure.entity';
import { SuperbillCharge } from './superbill-charge.entity';
import { SuperbillPayment } from './superbill-payment.entity';

export enum SuperbillStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  PROCESSED = 'processed',
  PAID = 'paid',
  REJECTED = 'rejected',
  RESUBMITTED = 'resubmitted',
  VOIDED = 'voided',
  CORRECTED = 'corrected',
}

@Entity('superbills')
@Index(['tenantId', 'patientId'])
export class Superbill {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  @Index()
  tenantId: string | null;

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

  @Column({ nullable: true })
  providerTaxId: string;

  @Column({ nullable: true })
  posCode: string;

  @Column({ nullable: true })
  facilityName: string;

  @Column({ nullable: true })
  facilityNPI: string;

  @Column({ nullable: true })
  referralNumber: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  feeSchedule: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  claimFrequency: string;

  @Column({ type: 'date', nullable: true })
  admissionDate: Date;

  @Column({ type: 'date', nullable: true })
  dischargeDate: Date;

  @Column({ type: 'boolean', default: false })
  isEmploymentRelated: boolean;

  @Column({ type: 'boolean', default: false })
  isAutoAccident: boolean;

  @Column({ type: 'boolean', default: false })
  isOtherAccident: boolean;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  balance: number;

  @OneToMany(() => SuperbillPayment, (payment) => payment.superbill, {
    cascade: true,
    eager: true,
    nullable: true,
  })
  payments: SuperbillPayment[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
