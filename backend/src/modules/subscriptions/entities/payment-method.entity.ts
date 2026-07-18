import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum PaymentMethodType {
  CARD = 'card',
  US_BANK_ACCOUNT = 'us_bank_account',
  SEPA_DEBIT = 'sepa_debit',
  BACS_DEBIT = 'bacs_debit',
  ACSS_DEBIT = 'acss_debit',
}

export enum CardBrand {
  VISA = 'visa',
  MASTERCARD = 'mastercard',
  AMEX = 'amex',
  DISCOVER = 'discover',
  JCB = 'jcb',
  DINERS = 'diners',
  UNIONPAY = 'unionpay',
  UNKNOWN = 'unknown',
}

/**
 * A saved payment method for a tenant (card, ACH, etc.).
 * Supports multiple payment methods per tenant (Phase 3).
 * The Stripe PaymentMethod ID is stored — actual card details
 * are never stored on our servers (PCI compliance).
 */
@Entity('subscription_payment_methods')
@Index(['tenantId'])
@Index(['tenantId', 'isDefault'])
export class SubscriptionPaymentMethod {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({
    name: 'stripe_payment_method_id',
    type: 'varchar',
    length: 100,
  })
  stripePaymentMethodId!: string;

  @Column({
    type: 'enum',
    enum: PaymentMethodType,
    default: PaymentMethodType.CARD,
  })
  type!: PaymentMethodType;

  // ── Card-specific fields (null for ACH/bank) ──────────────────────
  @Column({ name: 'card_brand', type: 'varchar', length: 20, nullable: true })
  cardBrand!: CardBrand | null;

  @Column({ name: 'card_last4', type: 'varchar', length: 4, nullable: true })
  cardLast4!: string | null;

  @Column({ name: 'card_exp_month', type: 'integer', nullable: true })
  cardExpMonth!: number | null;

  @Column({ name: 'card_exp_year', type: 'integer', nullable: true })
  cardExpYear!: number | null;

  @Column({ name: 'card_funding', type: 'varchar', length: 20, nullable: true })
  cardFunding!: string | null; // credit | debit | prepaid | unknown

  // ── Bank/ACH-specific fields (null for cards) ─────────────────────
  @Column({ name: 'bank_name', type: 'varchar', length: 100, nullable: true })
  bankName!: string | null;

  @Column({ name: 'bank_last4', type: 'varchar', length: 4, nullable: true })
  bankLast4!: string | null;

  @Column({ name: 'bank_account_type', type: 'varchar', length: 20, nullable: true })
  bankAccountType!: string | null; // checking | savings

  // ── Billing address ───────────────────────────────────────────────
  @Column({ name: 'billing_name', type: 'varchar', length: 200, nullable: true })
  billingName!: string | null;

  @Column({ name: 'billing_address', type: 'jsonb', nullable: true })
  billingAddress!: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  } | null;

  // ── Metadata ──────────────────────────────────────────────────────
  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault!: boolean;

  @Column({ name: 'is_hsa_fsa', type: 'boolean', default: false })
  isHsaFsa!: boolean;

  @Column({ name: 'metadata', type: 'jsonb', default: {} })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
