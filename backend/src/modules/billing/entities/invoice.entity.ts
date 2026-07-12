import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { DecimalTransformer } from '../../../common/transformers/decimal.transformer';

export enum InvoiceStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  PARTIALLY_PAID = 'partially_paid',
  PAID = 'paid',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled',
}

export enum InvoiceType {
  CASH_PAY = 'cash_pay',
  SELF_PAY = 'self_pay',
  BALANCE_DUE = 'balance_due',
}

@Entity('invoices')
@Index(['tenantId', 'invoiceNumber', 'patientId'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'dueDate'])
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  @Index()
  tenantId!: string;

  @Column({ name: 'invoice_number', type: 'varchar', length: 50, unique: true })
  invoiceNumber!: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  @Index()
  patientId!: string;

  @Column({ name: 'patient_name', type: 'varchar', length: 255 })
  patientName!: string;

  @Column({ name: 'encounter_id', type: 'uuid', nullable: true })
  encounterId!: string | null;

  @Column({ name: 'claim_id', type: 'uuid', nullable: true })
  claimId!: string | null;

  @Column({
    type: 'enum',
    enum: InvoiceType,
    default: InvoiceType.CASH_PAY,
  })
  invoiceType!: InvoiceType;

  @Column({ name: 'provider_id', type: 'uuid' })
  providerId!: string;

  @Column({ name: 'provider_name', type: 'varchar', length: 255 })
  providerName!: string;

  @Column({ name: 'service_date', type: 'date' })
  serviceDate!: Date;

  @Column({ name: 'invoice_date', type: 'date' })
  invoiceDate!: Date;

  @Column({ name: 'due_date', type: 'date' })
  dueDate!: Date;

  @Column({
    type: 'enum',
    enum: InvoiceStatus,
    default: InvoiceStatus.DRAFT,
  })
  status!: InvoiceStatus;

  @Column({ name: 'subtotal', type: 'decimal', precision: 10, scale: 2, default: 0, transformer: DecimalTransformer })
  subtotal!: number;

  @Column({ name: 'tax_amount', type: 'decimal', precision: 10, scale: 2, default: 0, transformer: DecimalTransformer })
  taxAmount!: number;

  @Column({ name: 'discount_amount', type: 'decimal', precision: 10, scale: 2, default: 0, transformer: DecimalTransformer })
  discountAmount!: number;

  @Column({ name: 'total_amount', type: 'decimal', precision: 10, scale: 2, default: 0, transformer: DecimalTransformer })
  totalAmount!: number;

  @Column({ name: 'amount_paid', type: 'decimal', precision: 10, scale: 2, default: 0, transformer: DecimalTransformer })
  amountPaid!: number;

  @Column({ name: 'balance_due', type: 'decimal', precision: 10, scale: 2, default: 0, transformer: DecimalTransformer })
  balanceDue!: number;

  @Column({ name: 'payment_method', type: 'varchar', length: 50, nullable: true })
  paymentMethod!: string | null;

  @Column({ name: 'payment_reference', type: 'varchar', length: 100, nullable: true })
  paymentReference!: string | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'metadata', type: 'jsonb', default: {} })
  metadata!: Record<string, unknown>;

  @OneToMany('ClaimLineItem', 'claim', {
    cascade: true,
    eager: true,
  })
  lineItems!: unknown[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
