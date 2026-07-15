import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Subscription,
  SubscriptionStatus,
  BillingCycle,
} from './entities/subscription.entity';
import { SubscriptionPlan, PlanTier } from './entities/subscription-plan.entity';
import {
  SubscriptionInvoice,
  SubscriptionInvoiceStatus,
} from './entities/subscription-invoice.entity';
import {
  SubscriptionProvider,
  SUBSCRIPTION_PROVIDER,
} from './providers/subscription-provider.interface';
import { SubscriptionNotificationService } from './subscription-notification.service';

const TRIAL_DAYS = 14;

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    @InjectRepository(Subscription)
    private subscriptionRepository: Repository<Subscription>,
    @InjectRepository(SubscriptionPlan)
    private planRepository: Repository<SubscriptionPlan>,
    @InjectRepository(SubscriptionInvoice)
    private invoiceRepository: Repository<SubscriptionInvoice>,
    @Inject(SUBSCRIPTION_PROVIDER)
    private subscriptionProvider: SubscriptionProvider,
    private notificationService: SubscriptionNotificationService,
  ) {}

  // ── Plan queries ──────────────────────────────────────────────────

  async getAllPlans(): Promise<SubscriptionPlan[]> {
    return this.planRepository.find({
      where: { isActive: true },
      order: { priceMonthlyCents: 'ASC' },
    });
  }

  async getPlanByTier(tier: string): Promise<SubscriptionPlan> {
    const plan = await this.planRepository.findOne({
      where: { tier: tier as PlanTier, isActive: true },
    });
    if (!plan) throw new NotFoundException(`Plan tier "${tier}" not found`);
    return plan;
  }

  // ── Subscription lifecycle ────────────────────────────────────────

  /**
   * Create a new subscription for a tenant (called during registration).
   * Starts with a 14-day trial.
   */
  async createSubscription(params: {
    tenantId: string;
    tenantName: string;
    tenantEmail: string;
    planTier: string;
    billingCycle?: BillingCycle;
  }): Promise<Subscription> {
    // Check if tenant already has a subscription
    const existing = await this.subscriptionRepository.findOne({
      where: { tenantId: params.tenantId },
    });
    if (existing) {
      throw new BadRequestException('Tenant already has a subscription');
    }

    const plan = await this.getPlanByTier(params.planTier);
    const billingCycle = params.billingCycle ?? BillingCycle.MONTHLY;
    const priceCents =
      billingCycle === BillingCycle.ANNUAL ? plan.priceAnnualCents : plan.priceMonthlyCents;

    const now = new Date();
    const trialEnd = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

    // Create internal subscription record first
    const subscription = this.subscriptionRepository.create({
      tenantId: params.tenantId,
      planTier: params.planTier,
      status: SubscriptionStatus.TRIALING,
      billingCycle,
      priceCents,
      currency: 'usd',
      trialEndsAt: trialEnd,
      currentPeriodStart: now,
      currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      provider: this.subscriptionProvider.name,
      metadata: { tenantName: params.tenantName, planName: plan.name },
    });
    const saved = await this.subscriptionRepository.save(subscription);

    // Create subscription via provider (Stripe or mock)
    try {
      const providerSub = await this.subscriptionProvider.createSubscription({
        subscriptionId: saved.id,
        tenantId: params.tenantId,
        tenantName: params.tenantName,
        tenantEmail: params.tenantEmail,
        planTier: params.planTier,
        billingCycle,
        priceCents,
        stripePriceId:
          billingCycle === BillingCycle.ANNUAL
            ? plan.stripePriceAnnualId
            : plan.stripePriceMonthlyId,
        trialDays: TRIAL_DAYS,
      });

      saved.stripeCustomerId = providerSub.providerCustomerId;
      saved.stripeSubscriptionId = providerSub.providerSubscriptionId;
      saved.currentPeriodStart = providerSub.currentPeriodStart;
      saved.currentPeriodEnd = providerSub.currentPeriodEnd;
      if (providerSub.trialEnd) saved.trialEndsAt = providerSub.trialEnd;
      await this.subscriptionRepository.save(saved);

      this.logger.log(
        `Subscription created for tenant ${params.tenantName} (plan: ${params.planTier}, provider: ${this.subscriptionProvider.name})`,
      );
    } catch (err) {
      // Provider failed — keep the internal record in trialing status
      // so the tenant can still use the trial. Payment can be retried.
      this.logger.error(
        `Provider subscription creation failed: ${(err as Error).message}. Subscription ${saved.id} remains in trial.`,
      );
    }

    return saved;
  }

  /**
   * Get the current subscription for a tenant.
   */
  async getSubscription(tenantId: string): Promise<Subscription> {
    const sub = await this.subscriptionRepository.findOne({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
    if (!sub) throw new NotFoundException('No subscription found for this tenant');
    return sub;
  }

  /**
   * Get subscription with plan details.
   */
  async getSubscriptionWithPlan(tenantId: string): Promise<{
    subscription: Subscription;
    plan: SubscriptionPlan;
  }> {
    const subscription = await this.getSubscription(tenantId);
    const plan = await this.getPlanByTier(subscription.planTier);
    return { subscription, plan };
  }

  /**
   * Change the plan tier (upgrade/downgrade).
   */
  async changePlan(
    tenantId: string,
    newPlanTier: string,
    billingCycle?: BillingCycle,
  ): Promise<Subscription> {
    const subscription = await this.getSubscription(tenantId);
    const newPlan = await this.getPlanByTier(newPlanTier);
    const oldPlanTier = subscription.planTier;

    if (subscription.planTier === newPlanTier && !billingCycle) {
      return subscription; // No change
    }

    const cycle = billingCycle ?? subscription.billingCycle;
    const newPriceCents =
      cycle === BillingCycle.ANNUAL ? newPlan.priceAnnualCents : newPlan.priceMonthlyCents;

    // Update via provider if Stripe is configured
    if (
      subscription.stripeSubscriptionId &&
      this.subscriptionProvider.name === 'stripe'
    ) {
      const stripePriceId =
        cycle === BillingCycle.ANNUAL
          ? newPlan.stripePriceAnnualId
          : newPlan.stripePriceMonthlyId;

      if (stripePriceId) {
        try {
          await this.subscriptionProvider.changePlan({
            providerSubscriptionId: subscription.stripeSubscriptionId,
            newStripePriceId: stripePriceId,
            prorate: true,
          });
        } catch (err) {
          this.logger.error(`Stripe plan change failed: ${(err as Error).message}`);
          throw new BadRequestException(
            `Failed to change plan via Stripe: ${(err as Error).message}`,
          );
        }
      }
    }

    subscription.planTier = newPlanTier;
    subscription.billingCycle = cycle;
    subscription.priceCents = newPriceCents;
    const saved = await this.subscriptionRepository.save(subscription);

    // Trigger plan change notification
    try {
      await this.notificationService.onPlanChanged(saved, oldPlanTier, newPlanTier);
    } catch (err) {
      this.logger.error(`Plan change notification failed: ${(err as Error).message}`);
    }

    return saved;
  }

  /**
   * Cancel a subscription (immediately or at period end).
   */
  async cancelSubscription(
    tenantId: string,
    cancelAtPeriodEnd: boolean,
  ): Promise<Subscription> {
    const subscription = await this.getSubscription(tenantId);

    if (subscription.stripeSubscriptionId && this.subscriptionProvider.name === 'stripe') {
      try {
        const result = await this.subscriptionProvider.cancelSubscription({
          providerSubscriptionId: subscription.stripeSubscriptionId,
          cancelAtPeriodEnd,
        });
        subscription.cancelAtPeriodEnd = result.cancelAtPeriodEnd;
        if (!cancelAtPeriodEnd) {
          subscription.status = SubscriptionStatus.CANCELLED;
          subscription.cancelledAt = result.canceledAt ?? new Date();
        }
      } catch (err) {
        this.logger.error(`Stripe cancel failed: ${(err as Error).message}`);
        throw new BadRequestException(
          `Failed to cancel subscription via Stripe: ${(err as Error).message}`,
        );
      }
    } else {
      // Mock provider
      subscription.cancelAtPeriodEnd = cancelAtPeriodEnd;
      if (!cancelAtPeriodEnd) {
        subscription.status = SubscriptionStatus.CANCELLED;
        subscription.cancelledAt = new Date();
      }
    }

    const saved = await this.subscriptionRepository.save(subscription);

    // Trigger cancellation notification
    try {
      await this.notificationService.onSubscriptionCancelled(saved, cancelAtPeriodEnd);
    } catch (err) {
      this.logger.error(`Cancel notification failed: ${(err as Error).message}`);
    }

    return saved;
  }

  /**
   * Reactivate a cancelled subscription (if still within the period).
   */
  async reactivateSubscription(tenantId: string): Promise<Subscription> {
    const subscription = await this.getSubscription(tenantId);
    if (subscription.status !== SubscriptionStatus.CANCELLED && !subscription.cancelAtPeriodEnd) {
      throw new BadRequestException('Subscription is not cancelled');
    }
    subscription.status = SubscriptionStatus.ACTIVE;
    subscription.cancelAtPeriodEnd = false;
    subscription.cancelledAt = null;
    return this.subscriptionRepository.save(subscription);
  }

  // ── Invoice history ───────────────────────────────────────────────

  async getInvoices(tenantId: string): Promise<SubscriptionInvoice[]> {
    return this.invoiceRepository.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Generate a subscription invoice (called by cron or webhook).
   * In mock mode, this creates a paid invoice for the current period.
   */
  async generateInvoice(subscriptionId: string): Promise<SubscriptionInvoice> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { id: subscriptionId },
    });
    if (!subscription) throw new NotFoundException('Subscription not found');

    const invoiceNumber = `SUB-${Date.now()}-${subscriptionId.substring(0, 6).toUpperCase()}`;
    const amount = subscription.priceCents / 100;

    const invoice = this.invoiceRepository.create({
      tenantId: subscription.tenantId,
      subscriptionId: subscription.id,
      invoiceNumber,
      planTier: subscription.planTier,
      billingCycle: subscription.billingCycle,
      amount,
      currency: subscription.currency,
      status:
        subscription.provider === 'mock'
          ? SubscriptionInvoiceStatus.PAID
          : SubscriptionInvoiceStatus.OPEN,
      periodStart: subscription.currentPeriodStart ?? new Date(),
      periodEnd: subscription.currentPeriodEnd ?? new Date(),
      paidAt: subscription.provider === 'mock' ? new Date() : null,
    });

    return this.invoiceRepository.save(invoice);
  }

  // ── Webhook handling ──────────────────────────────────────────────

  async handleWebhook(rawBody: string, signature: string): Promise<{ processed: boolean }> {
    const event = this.subscriptionProvider.parseWebhook(rawBody, signature);
    this.logger.log(
      `Subscription webhook: ${event.providerSubscriptionId} → ${event.status}`,
    );

    const subscription = await this.subscriptionRepository.findOne({
      where: { stripeSubscriptionId: event.providerSubscriptionId },
    });
    if (!subscription) {
      this.logger.warn(
        `Webhook for unknown subscription ${event.providerSubscriptionId}`,
      );
      return { processed: false };
    }

    const previousStatus = subscription.status;

    switch (event.status) {
      case 'active':
        subscription.status = SubscriptionStatus.ACTIVE;
        break;
      case 'past_due':
        subscription.status = SubscriptionStatus.PAST_DUE;
        break;
      case 'canceled':
        subscription.status = SubscriptionStatus.CANCELLED;
        subscription.cancelledAt = new Date();
        break;
      case 'expired':
        subscription.status = SubscriptionStatus.EXPIRED;
        break;
      case 'trialing':
        subscription.status = SubscriptionStatus.TRIALING;
        break;
    }

    if (event.currentPeriodStart) subscription.currentPeriodStart = event.currentPeriodStart;
    if (event.currentPeriodEnd) subscription.currentPeriodEnd = event.currentPeriodEnd;
    if (event.trialEnd !== undefined) subscription.trialEndsAt = event.trialEnd;

    await this.subscriptionRepository.save(subscription);

    // ── Trigger event-driven notifications ──────────────────────────
    // Only fire when the status actually changed (idempotency at notification level too)
    if (previousStatus !== subscription.status) {
      try {
        if (subscription.status === SubscriptionStatus.PAST_DUE) {
          await this.notificationService.onPaymentFailed(subscription);
        } else if (subscription.status === SubscriptionStatus.ACTIVE && previousStatus === SubscriptionStatus.PAST_DUE) {
          // Payment recovered after failure
          await this.notificationService.onPaymentSucceeded(subscription);
        } else if (subscription.status === SubscriptionStatus.ACTIVE && previousStatus === SubscriptionStatus.TRIALING) {
          // Trial converted to paid
          await this.notificationService.onPaymentSucceeded(subscription);
        } else if (subscription.status === SubscriptionStatus.CANCELLED) {
          await this.notificationService.onSubscriptionCancelled(subscription, false);
        } else if (subscription.status === SubscriptionStatus.EXPIRED) {
          await this.notificationService.onSubscriptionCancelled(subscription, false);
        }
      } catch (err) {
        this.logger.error(`Notification trigger failed: ${(err as Error).message}`);
      }
    }

    return { processed: true };
  }

  // ── Usage / feature gates ─────────────────────────────────────────

  /**
   * Check if the tenant's subscription includes a specific feature.
   */
  async hasFeature(tenantId: string, feature: string): Promise<boolean> {
    try {
      const { plan } = await this.getSubscriptionWithPlan(tenantId);
      switch (feature) {
        case 'rcm':
          return plan.includesRcm;
        case 'ai_scribe':
          return plan.includesAiScribe;
        case 'ai_coding':
          return plan.includesAiCoding;
        case 'patient_portal':
          return plan.includesPatientPortal;
        case 'automation':
          return plan.includesAutomation;
        default:
          return false;
      }
    } catch {
      return false;
    }
  }

  /**
   * Check if the tenant can add more providers.
   */
  async canAddProvider(tenantId: string, currentProviderCount: number): Promise<boolean> {
    try {
      const { plan } = await this.getSubscriptionWithPlan(tenantId);
      if (plan.maxProviders === null) return true; // unlimited
      return currentProviderCount < plan.maxProviders;
    } catch {
      return false;
    }
  }
}
