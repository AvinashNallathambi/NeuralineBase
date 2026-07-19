import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { SubscriptionPlan, PlanTier } from './entities/subscription-plan.entity';
import {
  Subscription,
  SubscriptionStatus,
  BillingCycle,
} from './entities/subscription.entity';

/**
 * Seeds the three default subscription plans on first boot.
 * Matches the pricing defined in docs/PRICING-STRATEGY.md and the frontend PricingPage.
 *
 * Also seeds a default Professional-plan subscription for the in-memory dev tenant
 * (00000000-0000-0000-0000-000000000000) so the subscription management UI works
 * without going through the full registration flow.
 */
@Injectable()
export class SubscriptionSeedService implements OnModuleInit {
  private readonly logger = new Logger(SubscriptionSeedService.name);

  /** Sentinel tenant UUID matching the in-memory dev user in AuthService. */
  private static readonly DEV_TENANT_ID = '00000000-0000-0000-0000-000000000000';

  constructor(
    @InjectRepository(SubscriptionPlan)
    private planRepository: Repository<SubscriptionPlan>,
    @InjectRepository(Subscription)
    private subscriptionRepository: Repository<Subscription>,
    private configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    let plansSeeded = false;
    try {
      const count = await this.planRepository.count();
      if (count > 0) {
        this.logger.log(`Subscription plans already seeded (${count} plans) — skipping`);
      } else {
        plansSeeded = await this.seedPlans();
      }
    } catch (err) {
      this.logger.warn(`Subscription plans table not available (migrations may not have run yet) — skipping seed`);
      return;
    }

    // Seed a dev-tenant subscription regardless of whether plans were just
    // seeded or already existed (idempotent — skips if dev sub already present).
    if (plansSeeded || (await this.planRepository.count()) > 0) {
      await this.seedDevSubscription();
    }
  }

  private async seedPlans(): Promise<boolean> {
    this.logger.log('Seeding default subscription plans...');

    // Load Stripe Price IDs from environment if configured. These are required
    // for real Stripe subscriptions; in mock mode they can be left empty.
    const stripePriceSoloMonthly = this.configService.get<string>('STRIPE_PRICE_SOLO_MONTHLY', '');
    const stripePriceSoloAnnual = this.configService.get<string>('STRIPE_PRICE_SOLO_ANNUAL', '');
    const stripePriceProfessionalMonthly = this.configService.get<string>('STRIPE_PRICE_PROFESSIONAL_MONTHLY', '');
    const stripePriceProfessionalAnnual = this.configService.get<string>('STRIPE_PRICE_PROFESSIONAL_ANNUAL', '');
    const stripePriceEnterpriseMonthly = this.configService.get<string>('STRIPE_PRICE_ENTERPRISE_MONTHLY', '');
    const stripePriceEnterpriseAnnual = this.configService.get<string>('STRIPE_PRICE_ENTERPRISE_ANNUAL', '');

    const plans: Partial<SubscriptionPlan>[] = [
      {
        tier: PlanTier.SOLO,
        name: 'Solo',
        description: 'For solo practitioners & cash-pay practices',
        priceMonthlyCents: 9900,
        priceAnnualCents: 8400,
        stripePriceMonthlyId: stripePriceSoloMonthly || null,
        stripePriceAnnualId: stripePriceSoloAnnual || null,
        maxProviders: 1,
        maxPatients: null,
        maxLocations: 1,
        includesRcm: false,
        includesAiScribe: false,
        includesAiCoding: false,
        includesPatientPortal: true,
        includesAutomation: false,
        aiCreditsMonthly: 0,
      },
      {
        tier: PlanTier.PROFESSIONAL,
        name: 'Professional',
        description: 'For growing clinics (2–10 providers)',
        priceMonthlyCents: 24900,
        priceAnnualCents: 21200,
        stripePriceMonthlyId: stripePriceProfessionalMonthly || null,
        stripePriceAnnualId: stripePriceProfessionalAnnual || null,
        maxProviders: 25,
        maxPatients: null,
        maxLocations: 5,
        includesRcm: true,
        includesAiScribe: true,
        includesAiCoding: true,
        includesPatientPortal: true,
        includesAutomation: false,
        aiCreditsMonthly: 500,
      },
      {
        tier: PlanTier.ENTERPRISE,
        name: 'Enterprise',
        description: 'For multi-site practices & health systems',
        priceMonthlyCents: 49900,
        priceAnnualCents: 42400,
        stripePriceMonthlyId: stripePriceEnterpriseMonthly || null,
        stripePriceAnnualId: stripePriceEnterpriseAnnual || null,
        maxProviders: null,
        maxPatients: null,
        maxLocations: null,
        includesRcm: true,
        includesAiScribe: true,
        includesAiCoding: true,
        includesPatientPortal: true,
        includesAutomation: true,
        aiCreditsMonthly: 5000,
      },
    ];

    for (const plan of plans) {
      await this.planRepository.save(this.planRepository.create(plan));
    }

    this.logger.log(`Seeded ${plans.length} subscription plans (Solo, Professional, Enterprise)`);
    return true;
  }

  /**
   * Seed a default Professional-plan subscription for the in-memory dev tenant
   * so the subscription management UI works without going through registration.
   */
  private async seedDevSubscription(): Promise<void> {
    const devTenantId = SubscriptionSeedService.DEV_TENANT_ID;

    const existing = await this.subscriptionRepository.findOne({
      where: { tenantId: devTenantId },
    });
    if (existing) {
      this.logger.log('Dev tenant subscription already exists — skipping');
      return;
    }

    const plan = await this.planRepository.findOne({
      where: { tier: PlanTier.PROFESSIONAL },
    });
    if (!plan) {
      this.logger.warn('Professional plan not found — skipping dev subscription seed');
      return;
    }

    const now = new Date();
    const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    const subscription = this.subscriptionRepository.create({
      tenantId: devTenantId,
      planTier: PlanTier.PROFESSIONAL,
      status: SubscriptionStatus.TRIALING,
      billingCycle: BillingCycle.MONTHLY,
      priceCents: plan.priceMonthlyCents,
      currency: 'usd',
      trialEndsAt: trialEnd,
      currentPeriodStart: now,
      currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      provider: 'mock',
      stripeCustomerId: 'mock_cus_devtenant',
      stripeSubscriptionId: 'mock_sub_devtenant',
      metadata: { tenantName: 'Neuraline Dev Clinic', planName: plan.name },
    });
    await this.subscriptionRepository.save(subscription);

    this.logger.log('Seeded dev tenant subscription (Professional, trialing)');
  }
}
