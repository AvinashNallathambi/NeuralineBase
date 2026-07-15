import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum PlanTier {
  SOLO = 'solo',
  PROFESSIONAL = 'professional',
  ENTERPRISE = 'enterprise',
}

export enum BillingCycle {
  MONTHLY = 'monthly',
  ANNUAL = 'annual',
}

/**
 * Static plan definition. Seeded once at boot via SubscriptionSeedService.
 * Prices are stored in cents to avoid floating-point issues.
 */
@Entity('subscription_plans')
export class SubscriptionPlan {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: PlanTier, unique: true })
  tier!: PlanTier;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'varchar', length: 255 })
  description!: string;

  /** Monthly price in cents (e.g. 9900 = $99.00) */
  @Column({ name: 'price_monthly_cents', type: 'integer' })
  priceMonthlyCents!: number;

  /** Annual price in cents (per month, billed annually — e.g. 8400 = $84.00/mo) */
  @Column({ name: 'price_annual_cents', type: 'integer' })
  priceAnnualCents!: number;

  @Column({ name: 'max_providers', type: 'integer', nullable: true })
  maxProviders!: number | null; // null = unlimited

  @Column({ name: 'max_patients', type: 'integer', nullable: true })
  maxPatients!: number | null; // null = unlimited

  @Column({ name: 'max_locations', type: 'integer', nullable: true })
  maxLocations!: number | null;

  @Column({ name: 'includes_rcm', type: 'boolean', default: false })
  includesRcm!: boolean;

  @Column({ name: 'includes_ai_scribe', type: 'boolean', default: false })
  includesAiScribe!: boolean;

  @Column({ name: 'includes_ai_coding', type: 'boolean', default: false })
  includesAiCoding!: boolean;

  @Column({ name: 'includes_patient_portal', type: 'boolean', default: false })
  includesPatientPortal!: boolean;

  @Column({ name: 'includes_automation', type: 'boolean', default: false })
  includesAutomation!: boolean;

  @Column({ name: 'ai_credits_monthly', type: 'integer', default: 0 })
  aiCreditsMonthly!: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  /** Stripe price IDs for checkout integration (optional — null in dev/mock mode) */
  @Column({ name: 'stripe_price_monthly_id', type: 'varchar', length: 100, nullable: true })
  stripePriceMonthlyId!: string | null;

  @Column({ name: 'stripe_price_annual_id', type: 'varchar', length: 100, nullable: true })
  stripePriceAnnualId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
