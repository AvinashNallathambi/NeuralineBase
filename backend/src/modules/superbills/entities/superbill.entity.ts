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

  // ── CMS-1500 additional fields ──────────────────────────────────────────
  @Column({ type: 'varchar', length: 1, nullable: true })
  patientSex: string; // M | F

  @Column({ type: 'varchar', length: 20, nullable: true })
  insuranceProgram: string; // medicare | medicaid | tricare | champva | group_health_plan | feca | blk_lung | other

  @Column({ type: 'varchar', length: 1, nullable: true })
  insuredSex: string; // M | F

  @Column({ type: 'date', nullable: true })
  insuredDOB: Date;

  @Column({ type: 'jsonb', nullable: true })
  insuredAddress: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  } | null;

  @Column({ type: 'date', nullable: true })
  dateOfIllness: Date; // Field 14 — date of current illness/injury/pregnancy

  @Column({ type: 'varchar', length: 100, nullable: true })
  referringProviderName: string; // Field 17

  @Column({ type: 'varchar', length: 15, nullable: true })
  referringProviderNPI: string; // Field 17b

  @Column({ type: 'boolean', nullable: true })
  outsideLab: boolean; // Field 20

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  outsideLabCharges: number; // Field 20

  @Column({ type: 'varchar', length: 20, nullable: true })
  resubmissionCode: string; // Field 22

  @Column({ type: 'varchar', length: 50, nullable: true })
  originalRefNo: string; // Field 22

  @Column({ type: 'varchar', length: 50, nullable: true })
  priorAuthNumber: string; // Field 23

  @Column({ type: 'boolean', default: true })
  acceptAssignment: boolean; // Field 27 — YES by default

  @Column({ type: 'varchar', length: 50, nullable: true })
  patientAccountNo: string; // Field 26

  @Column({ type: 'varchar', length: 15, nullable: true })
  renderingProviderId: string; // Field 24J

  @Column({ type: 'varchar', length: 100, nullable: true })
  physicianSignature: string; // Field 31 — typed name

  @Column({ type: 'date', nullable: true })
  physicianSignatureDate: Date; // Field 31

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  amountPaid: number; // Field 29 — amount paid by patient

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
