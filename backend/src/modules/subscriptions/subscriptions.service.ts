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
  SubscriptionPaymentMethod,
  PaymentMethodType,
  CardBrand,
} from './entities/payment-method.entity';
import {
  SubscriptionPaymentPlan,
  PaymentPlanStatus,
  PaymentPlanFrequency,
} from './entities/payment-plan.entity';
import { SubscriptionWebhookEvent } from './entities/subscription-webhook-event.entity';
import {
  SubscriptionProvider,
  SUBSCRIPTION_PROVIDER,
  PaymentMethodDetails,
} from './providers/subscription-provider.interface';
import { SubscriptionNotificationService } from './subscription-notification.service';

const DEFAULT_TRIAL_DAYS = 14;

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
    @InjectRepository(SubscriptionPaymentMethod)
    private paymentMethodRepository: Repository<SubscriptionPaymentMethod>,
    @InjectRepository(SubscriptionPaymentPlan)
    private paymentPlanRepository: Repository<SubscriptionPaymentPlan>,
    @InjectRepository(SubscriptionWebhookEvent)
    private webhookEventRepository: Repository<SubscriptionWebhookEvent>,
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
    trialDays?: number;
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

    const trialDays = params.trialDays ?? DEFAULT_TRIAL_DAYS;
    const now = new Date();
    const trialEnd = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);

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
        trialDays,
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
    const oldPriceCents = subscription.priceCents;

    // Determine proration behavior: create prorations for upgrades, none for downgrades
    const isUpgrade = newPriceCents > oldPriceCents;
    const prorate = isUpgrade;

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
            prorate,
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
   * Persist an updated subscription record.
   */
  async updateSubscription(subscription: Subscription): Promise<Subscription> {
    return this.subscriptionRepository.save(subscription);
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

  async handleWebhook(rawBody: string | Buffer, signature: string): Promise<{ processed: boolean }> {
    const event = this.subscriptionProvider.parseWebhook(rawBody, signature);

    // ── Idempotency: skip already-processed events ────────────────────
    const existing = await this.webhookEventRepository.findOne({
      where: { eventId: event.eventId },
    });
    if (existing) {
      this.logger.log(`Webhook event ${event.eventId} already processed — skipping`);
      return { processed: false };
    }

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
      await this.recordWebhookEvent(event, false, 'Unknown subscription');
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

    // ── Sync invoice data from webhook ───────────────────────────────
    if (event.invoice) {
      await this.syncInvoiceFromWebhook(subscription, event.invoice);
    }

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

    await this.recordWebhookEvent(event, true);
    return { processed: true };
  }

  /**
   * Persist a record of the processed webhook event for idempotency.
   */
  private async recordWebhookEvent(
    event: any,
    processed: boolean,
    errorMessage?: string,
  ): Promise<void> {
    try {
      const record = this.webhookEventRepository.create({
        eventId: event.eventId,
        eventType: event.rawEvent?.type ?? 'unknown',
        providerSubscriptionId: event.providerSubscriptionId,
        status: event.status,
        processed,
        invoiceId: event.invoice?.id ?? null,
        errorMessage: errorMessage ?? null,
      });
      await this.webhookEventRepository.save(record);
    } catch (err) {
      this.logger.error(`Failed to record webhook event: ${(err as Error).message}`);
    }
  }

  /**
   * Upsert a SubscriptionInvoice from a Stripe webhook invoice payload.
   */
  private async syncInvoiceFromWebhook(
    subscription: Subscription,
    invoice: any,
  ): Promise<void> {
    try {
      const existing = await this.invoiceRepository.findOne({
        where: { stripeInvoiceId: invoice.id },
      });

      if (existing) {
        existing.status = invoice.status;
        existing.amount = invoice.amount;
        existing.currency = invoice.currency;
        existing.paidAt = invoice.paidAt ?? null;
        existing.failureReason = invoice.failureReason ?? null;
        existing.stripeHostedInvoiceUrl = invoice.hostedInvoiceUrl ?? null;
        if (invoice.periodStart) existing.periodStart = invoice.periodStart;
        if (invoice.periodEnd) existing.periodEnd = invoice.periodEnd;
        await this.invoiceRepository.save(existing);
        return;
      }

      const newInvoice = this.invoiceRepository.create({
        tenantId: subscription.tenantId,
        subscriptionId: subscription.id,
        invoiceNumber: invoice.id,
        planTier: subscription.planTier,
        billingCycle: subscription.billingCycle,
        amount: invoice.amount,
        currency: invoice.currency,
        status: invoice.status,
        periodStart: invoice.periodStart ?? subscription.currentPeriodStart,
        periodEnd: invoice.periodEnd ?? subscription.currentPeriodEnd,
        paidAt: invoice.paidAt ?? null,
        failureReason: invoice.failureReason ?? null,
        stripeInvoiceId: invoice.id,
        stripeHostedInvoiceUrl: invoice.hostedInvoiceUrl ?? null,
      });
      await this.invoiceRepository.save(newInvoice);
    } catch (err) {
      this.logger.error(`Failed to sync invoice from webhook: ${(err as Error).message}`);
    }
  }

  // ── Mock Billing Simulation ───────────────────────────────────────

  /**
   * Simulates Stripe's recurring billing cycle for mock subscriptions.
   * Called daily by the subscription processor before notification checks.
   *
   * When a mock subscription's trial ends or current period ends:
   * - If a default payment method exists, create a paid invoice and set ACTIVE
   * - If no default payment method exists, create a failed invoice and set PAST_DUE
   * - After a 14-day dunning period, set EXPIRED
   */
  async processMockBillingSimulation(): Promise<void> {
    if (this.subscriptionProvider.name !== 'mock') {
      // Only run in mock mode; Stripe handles real billing
      return;
    }

    const now = new Date();
    const gracePeriodCutoff = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // 1. Convert trialing subscriptions whose trial has ended
    const trialingSubs = await this.subscriptionRepository.find({
      where: { status: SubscriptionStatus.TRIALING },
    });

    for (const sub of trialingSubs) {
      if (!sub.trialEndsAt || new Date(sub.trialEndsAt).getTime() > now.getTime()) {
        continue;
      }

      const defaultPm = await this.paymentMethodRepository.findOne({
        where: { tenantId: sub.tenantId, isDefault: true },
      });

      if (defaultPm) {
        // Successful trial conversion
        sub.status = SubscriptionStatus.ACTIVE;
        sub.currentPeriodStart = now;
        sub.currentPeriodEnd = new Date(
          now.getTime() + this.getCycleDays(sub.billingCycle) * 24 * 60 * 60 * 1000,
        );
        await this.subscriptionRepository.save(sub);

        await this.createMockInvoice(sub, sub.priceCents, 'paid', 'usd');
        this.logger.log(`Mock billing: trial converted for tenant ${sub.tenantId}`);

        try {
          await this.notificationService.onPaymentSucceeded(sub);
        } catch (err) {
          this.logger.error(`Mock payment succeeded notification failed: ${(err as Error).message}`);
        }
      } else {
        // Trial ended without payment method
        sub.status = SubscriptionStatus.PAST_DUE;
        sub.metadata = { ...sub.metadata, pastDueSince: now.toISOString() };
        await this.subscriptionRepository.save(sub);

        await this.createMockInvoice(sub, sub.priceCents, 'failed', 'usd', 'No payment method on file');
        this.logger.warn(`Mock billing: trial ended with no payment method for tenant ${sub.tenantId}`);

        try {
          await this.notificationService.onPaymentFailed(sub);
        } catch (err) {
          this.logger.error(`Mock payment failed notification failed: ${(err as Error).message}`);
        }
      }
    }

    // 2. Renew active subscriptions whose period has ended
    const activeSubs = await this.subscriptionRepository.find({
      where: { status: SubscriptionStatus.ACTIVE },
    });

    for (const sub of activeSubs) {
      if (!sub.currentPeriodEnd || new Date(sub.currentPeriodEnd).getTime() > now.getTime()) {
        continue;
      }

      const defaultPm = await this.paymentMethodRepository.findOne({
        where: { tenantId: sub.tenantId, isDefault: true },
      });

      if (defaultPm) {
        // Successful renewal
        sub.currentPeriodStart = now;
        sub.currentPeriodEnd = new Date(
          now.getTime() + this.getCycleDays(sub.billingCycle) * 24 * 60 * 60 * 1000,
        );
        await this.subscriptionRepository.save(sub);

        await this.createMockInvoice(sub, sub.priceCents, 'paid', 'usd');
        this.logger.log(`Mock billing: renewed subscription for tenant ${sub.tenantId}`);
      } else {
        // Renewal failed
        sub.status = SubscriptionStatus.PAST_DUE;
        sub.metadata = { ...sub.metadata, pastDueSince: now.toISOString() };
        await this.subscriptionRepository.save(sub);

        await this.createMockInvoice(sub, sub.priceCents, 'failed', 'usd', 'No payment method on file');
        this.logger.warn(`Mock billing: renewal failed for tenant ${sub.tenantId}`);

        try {
          await this.notificationService.onPaymentFailed(sub);
        } catch (err) {
          this.logger.error(`Mock payment failed notification failed: ${(err as Error).message}`);
        }
      }
    }

    // 3. Expire past_due subscriptions after grace period
    const pastDueSubs = await this.subscriptionRepository.find({
      where: { status: SubscriptionStatus.PAST_DUE },
    });

    for (const sub of pastDueSubs) {
      const pastDueSince = sub.metadata?.pastDueSince
        ? new Date(sub.metadata.pastDueSince as string)
        : sub.updatedAt;

      if (pastDueSince && pastDueSince.getTime() < gracePeriodCutoff.getTime()) {
        sub.status = SubscriptionStatus.EXPIRED;
        await this.subscriptionRepository.save(sub);
        this.logger.warn(`Mock billing: subscription expired for tenant ${sub.tenantId}`);

        try {
          await this.notificationService.onSubscriptionCancelled(sub, true);
        } catch (err) {
          this.logger.error(`Mock subscription cancelled notification failed: ${(err as Error).message}`);
        }
      }
    }
  }

  private getCycleDays(cycle: BillingCycle): number {
    return cycle === BillingCycle.ANNUAL ? 365 : 30;
  }

  private async createMockInvoice(
    subscription: Subscription,
    amountCents: number,
    status: 'paid' | 'failed' | 'open',
    currency: string,
    failureReason?: string,
  ): Promise<void> {
    const now = new Date();
    const periodEnd = new Date(
      now.getTime() + this.getCycleDays(subscription.billingCycle) * 24 * 60 * 60 * 1000,
    );

    const invoice = this.invoiceRepository.create({
      tenantId: subscription.tenantId,
      subscriptionId: subscription.id,
      invoiceNumber: `mock_inv_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      planTier: subscription.planTier,
      billingCycle: subscription.billingCycle,
      amount: amountCents / 100,
      currency,
      status: status as SubscriptionInvoiceStatus,
      periodStart: now,
      periodEnd,
      paidAt: status === 'paid' ? now : null,
      failureReason: failureReason ?? null,
      stripeInvoiceId: null,
      stripeHostedInvoiceUrl: null,
    });
    await this.invoiceRepository.save(invoice);
  }

  // ── Usage / feature gates ─────────────────────────────────────────

  /**
   * Check if the tenant's subscription is in an active/trialing state.
   * Used to enforce that payment is up to date before granting feature access.
   */
  async isSubscriptionActive(tenantId: string): Promise<boolean> {
    try {
      const subscription = await this.getSubscription(tenantId);
      return (
        subscription.status === SubscriptionStatus.ACTIVE ||
        subscription.status === SubscriptionStatus.TRIALING
      );
    } catch {
      return false;
    }
  }

  /**
   * Check if the tenant's subscription has an active payment method on file.
   * A default payment method is required for paid plans after the trial ends.
   */
  async hasDefaultPaymentMethod(tenantId: string): Promise<boolean> {
    try {
      const subscription = await this.getSubscription(tenantId);
      // Free/solo plans with $0 price may not need a payment method during trial
      if (subscription.status === SubscriptionStatus.TRIALING) {
        return true;
      }
      const pm = await this.paymentMethodRepository.findOne({
        where: { tenantId, isDefault: true },
      });
      return !!pm;
    } catch {
      return false;
    }
  }

  /**
   * Check if the tenant's subscription includes a specific feature.
   * Denies access when the subscription is past_due, cancelled, or expired,
   * or when the trial is over and no payment method is on file.
   */
  async hasFeature(tenantId: string, feature: string): Promise<boolean> {
    try {
      const subscription = await this.getSubscription(tenantId);
      const activeStatus =
        subscription.status === SubscriptionStatus.ACTIVE ||
        subscription.status === SubscriptionStatus.TRIALING;

      if (!activeStatus) {
        return false;
      }

      // If trial has ended, require a payment method on file
      if (this.isTrialExpired(subscription)) {
        const hasPm = await this.paymentMethodRepository.findOne({
          where: { tenantId, isDefault: true },
        });
        if (!hasPm) {
          this.logger.warn(`Feature ${feature} denied for tenant ${tenantId}: trial expired and no payment method`);
          return false;
        }
      }

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
   * Same subscription status/payment-method enforcement as hasFeature.
   */
  async canAddProvider(tenantId: string, currentProviderCount: number): Promise<boolean> {
    try {
      const subscription = await this.getSubscription(tenantId);
      const activeStatus =
        subscription.status === SubscriptionStatus.ACTIVE ||
        subscription.status === SubscriptionStatus.TRIALING;

      if (!activeStatus) {
        return false;
      }

      if (this.isTrialExpired(subscription)) {
        const hasPm = await this.paymentMethodRepository.findOne({
          where: { tenantId, isDefault: true },
        });
        if (!hasPm) {
          this.logger.warn(`canAddProvider denied for tenant ${tenantId}: trial expired and no payment method`);
          return false;
        }
      }

      const { plan } = await this.getSubscriptionWithPlan(tenantId);
      if (plan.maxProviders === null) return true; // unlimited
      return currentProviderCount < plan.maxProviders;
    } catch {
      return false;
    }
  }

  private isTrialExpired(subscription: Subscription): boolean {
    if (subscription.status !== SubscriptionStatus.TRIALING) return false;
    if (!subscription.trialEndsAt) return false;
    return new Date(subscription.trialEndsAt).getTime() <= Date.now();
  }

  // ── Payment Method Management (Phase 1, 3) ────────────────────────

  /**
   * Get all payment methods for a tenant.
   * Syncs from Stripe if a real Stripe customer ID exists, then returns DB records.
   * In mock mode, the database is the source of truth because the mock provider's
   * in-memory store is ephemeral across restarts.
   */
  async getPaymentMethods(tenantId: string): Promise<SubscriptionPaymentMethod[]> {
    const subscription = await this.getSubscription(tenantId);

    // Only sync from Stripe in production/stripe mode. In mock mode, the DB is authoritative.
    if (subscription.stripeCustomerId && this.subscriptionProvider.name === 'stripe') {
      try {
        await this.syncPaymentMethodsFromProvider(tenantId, subscription.stripeCustomerId);
      } catch (err) {
        this.logger.error(`Failed to sync payment methods: ${(err as Error).message}`);
      }
    }

    return this.paymentMethodRepository.find({
      where: { tenantId },
      order: { isDefault: 'DESC', createdAt: 'DESC' },
    });
  }

  /**
   * Create a SetupIntent for collecting new payment method details.
   */
  async createSetupIntent(
    tenantId: string,
    paymentMethodTypes?: string[],
  ): Promise<{ clientSecret: string; setupIntentId: string }> {
    const subscription = await this.getSubscription(tenantId);

    if (!subscription.stripeCustomerId) {
      // In mock mode, create a mock customer ID if needed
      if (this.subscriptionProvider.name === 'mock') {
        subscription.stripeCustomerId = `mock_cus_${tenantId.substring(0, 8)}`;
        await this.subscriptionRepository.save(subscription);
      } else {
        throw new BadRequestException('No Stripe customer found. Please contact support.');
      }
    }

    const result = await this.subscriptionProvider.createSetupIntent({
      stripeCustomerId: subscription.stripeCustomerId,
      paymentMethodTypes: paymentMethodTypes ?? ['card'],
      metadata: { tenantId },
    });

    return { clientSecret: result.clientSecret, setupIntentId: result.setupIntentId };
  }

  /**
   * Attach a new payment method (called after Stripe Elements confirms the SetupIntent).
   */
  async attachPaymentMethod(
    tenantId: string,
    stripePaymentMethodId: string,
    setAsDefault?: boolean,
  ): Promise<SubscriptionPaymentMethod> {
    const subscription = await this.getSubscription(tenantId);

    if (!subscription.stripeCustomerId) {
      throw new BadRequestException('No Stripe customer found');
    }

    const result = await this.subscriptionProvider.attachPaymentMethod({
      stripeCustomerId: subscription.stripeCustomerId,
      stripePaymentMethodId,
      setAsDefault: setAsDefault ?? true,
      stripeSubscriptionId: subscription.stripeSubscriptionId,
    });

    // Save to DB
    const pm = this.paymentMethodRepository.create(
      this.mapPaymentMethodDetailsToEntity(tenantId, result.paymentMethod),
    );
    const saved = await this.paymentMethodRepository.save(pm);

    // If set as default, unset others and update subscription
    if (setAsDefault ?? true) {
      // Unset default on all other payment methods for this tenant
      const others = await this.paymentMethodRepository.find({
        where: { tenantId },
      });
      for (const other of others) {
        if (other.id !== saved.id && other.isDefault) {
          other.isDefault = false;
          await this.paymentMethodRepository.save(other);
        }
      }
      subscription.stripePaymentMethodId = stripePaymentMethodId;
      await this.subscriptionRepository.save(subscription);
    }

    this.logger.log(`Payment method attached for tenant ${tenantId}: ${stripePaymentMethodId}`);
    return saved;
  }

  /**
   * Detach (remove) a payment method.
   */
  async detachPaymentMethod(
    tenantId: string,
    paymentMethodId: string,
  ): Promise<{ success: boolean }> {
    const pm = await this.paymentMethodRepository.findOne({
      where: { id: paymentMethodId, tenantId },
    });
    if (!pm) throw new NotFoundException('Payment method not found');

    if (pm.isDefault) {
      throw new BadRequestException(
        'Cannot remove the default payment method. Set another method as default first.',
      );
    }

    await this.subscriptionProvider.detachPaymentMethod({
      stripePaymentMethodId: pm.stripePaymentMethodId,
    });

    await this.paymentMethodRepository.remove(pm);
    this.logger.log(`Payment method removed for tenant ${tenantId}: ${paymentMethodId}`);
    return { success: true };
  }

  /**
   * Set a payment method as the default.
   */
  async setDefaultPaymentMethod(
    tenantId: string,
    paymentMethodId: string,
  ): Promise<SubscriptionPaymentMethod> {
    const pm = await this.paymentMethodRepository.findOne({
      where: { id: paymentMethodId, tenantId },
    });
    if (!pm) throw new NotFoundException('Payment method not found');

    const subscription = await this.getSubscription(tenantId);

    await this.subscriptionProvider.setDefaultPaymentMethod({
      stripeCustomerId: subscription.stripeCustomerId ?? '',
      stripePaymentMethodId: pm.stripePaymentMethodId,
      stripeSubscriptionId: subscription.stripeSubscriptionId,
    });

    // Update DB: unset all defaults, set the chosen one
    await this.paymentMethodRepository.update(
      { tenantId },
      { isDefault: false },
    );
    pm.isDefault = true;
    const saved = await this.paymentMethodRepository.save(pm);

    subscription.stripePaymentMethodId = pm.stripePaymentMethodId;
    await this.subscriptionRepository.save(subscription);

    this.logger.log(`Default payment method set for tenant ${tenantId}: ${paymentMethodId}`);
    return saved;
  }

  // ── Customer Portal (Phase 4) ─────────────────────────────────────

  /**
   * Create a Stripe Customer Portal session for self-service billing management.
   */
  async createCustomerPortalSession(
    tenantId: string,
    returnUrl: string,
  ): Promise<{ url: string }> {
    const subscription = await this.getSubscription(tenantId);
    if (!subscription.stripeCustomerId) {
      throw new BadRequestException('No Stripe customer found');
    }

    const result = await this.subscriptionProvider.createCustomerPortalSession({
      stripeCustomerId: subscription.stripeCustomerId,
      returnUrl,
    });

    return { url: result.url };
  }

  // ── Retry Payment / Dunning (Phase 2) ─────────────────────────────

  /**
   * Retry a failed invoice payment with the current default payment method.
   */
  async retryFailedPayment(tenantId: string): Promise<{ success: boolean; status: string }> {
    const subscription = await this.getSubscription(tenantId);

    // Find the most recent open/failed invoice
    const invoice = await this.invoiceRepository.findOne({
      where: {
        tenantId,
        status: SubscriptionInvoiceStatus.FAILED,
      },
      order: { createdAt: 'DESC' },
    });

    if (!invoice) {
      // Also check for open invoices
      const openInvoice = await this.invoiceRepository.findOne({
        where: {
          tenantId,
          status: SubscriptionInvoiceStatus.OPEN,
        },
        order: { createdAt: 'DESC' },
      });
      if (!openInvoice) {
        throw new NotFoundException('No failed or open invoice found to retry');
      }
    }

    const pm = await this.paymentMethodRepository.findOne({
      where: { tenantId, isDefault: true },
    });
    if (!pm) {
      throw new BadRequestException(
        'No default payment method found. Please add a payment method first.',
      );
    }

    // In mock mode, just mark as paid
    if (this.subscriptionProvider.name === 'mock' || !invoice) {
      if (invoice) {
        invoice.status = SubscriptionInvoiceStatus.PAID;
        invoice.paidAt = new Date();
        await this.invoiceRepository.save(invoice);
      }
      subscription.status = SubscriptionStatus.ACTIVE;
      await this.subscriptionRepository.save(subscription);
      return { success: true, status: 'paid' };
    }

    const result = await this.subscriptionProvider.retryInvoice({
      stripeInvoiceId: invoice.invoiceNumber,
      stripePaymentMethodId: pm.stripePaymentMethodId,
    });

    if (result.success) {
      invoice.status = SubscriptionInvoiceStatus.PAID;
      invoice.paidAt = new Date();
      await this.invoiceRepository.save(invoice);
      subscription.status = SubscriptionStatus.ACTIVE;
      await this.subscriptionRepository.save(subscription);

      try {
        await this.notificationService.onPaymentSucceeded(subscription);
      } catch (err) {
        this.logger.error(`Payment succeeded notification failed: ${(err as Error).message}`);
      }
    }

    return { success: result.success, status: result.status };
  }

  // ── Card Expiry Check (Phase 2) ───────────────────────────────────

  /**
   * Check for expiring cards and return warnings.
   * Called by the scheduler and the payment methods endpoint.
   */
  async checkCardExpiry(tenantId: string): Promise<{
    expiringSoon: SubscriptionPaymentMethod[];
    expired: SubscriptionPaymentMethod[];
  }> {
    const methods = await this.paymentMethodRepository.find({
      where: { tenantId, type: PaymentMethodType.CARD },
    });

    const now = new Date();
    const threeMonthsFromNow = new Date(now.getFullYear(), now.getMonth() + 3, 1);

    const expiringSoon: SubscriptionPaymentMethod[] = [];
    const expired: SubscriptionPaymentMethod[] = [];

    for (const pm of methods) {
      if (!pm.cardExpMonth || !pm.cardExpYear) continue;

      // Card expires at the end of the expiry month
      const expDate = new Date(pm.cardExpYear, pm.cardExpMonth, 1);
      expDate.setMonth(expDate.getMonth() + 1, 0); // Last day of expiry month

      if (expDate < now) {
        expired.push(pm);
      } else if (expDate <= threeMonthsFromNow) {
        expiringSoon.push(pm);
      }
    }

    return { expiringSoon, expired };
  }

  // ── Payment Plans / Scheduled Payments (Phase 4) ──────────────────

  /**
   * Get all payment plans for a tenant.
   */
  async getPaymentPlans(tenantId: string): Promise<SubscriptionPaymentPlan[]> {
    return this.paymentPlanRepository.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Create a new payment plan for splitting a balance across installments.
   */
  async createPaymentPlan(params: {
    tenantId: string;
    description: string;
    totalAmount: number;
    installmentAmount: number;
    frequency?: PaymentPlanFrequency;
    startDate?: Date;
    stripePaymentMethodId?: string;
  }): Promise<SubscriptionPaymentPlan> {
    const totalAmount = params.totalAmount;
    const installmentAmount = params.installmentAmount;
    const totalInstallments = Math.ceil(totalAmount / installmentAmount);
    const frequency = params.frequency ?? PaymentPlanFrequency.MONTHLY;
    const startDate = params.startDate ?? new Date();

    // Calculate next payment date based on frequency
    const nextPaymentDate = this.calculateNextPaymentDate(startDate, frequency);

    const plan = this.paymentPlanRepository.create({
      tenantId: params.tenantId,
      description: params.description,
      totalAmount,
      paidAmount: 0,
      installmentAmount,
      frequency,
      totalInstallments,
      paidInstallments: 0,
      status: PaymentPlanStatus.ACTIVE,
      nextPaymentDate,
      startDate,
      stripePaymentMethodId: params.stripePaymentMethodId ?? null,
      metadata: {},
    });

    return this.paymentPlanRepository.save(plan);
  }

  /**
   * Record a payment against a payment plan installment.
   */
  async recordPaymentPlanInstallment(
    tenantId: string,
    planId: string,
    amount: number,
  ): Promise<SubscriptionPaymentPlan> {
    const plan = await this.paymentPlanRepository.findOne({
      where: { id: planId, tenantId },
    });
    if (!plan) throw new NotFoundException('Payment plan not found');

    // Handle decimal columns which may come back as strings
    const currentPaid = typeof plan.paidAmount === 'string' 
      ? parseFloat(plan.paidAmount) 
      : Number(plan.paidAmount);
    plan.paidAmount = Math.round((currentPaid + amount) * 100) / 100 as any;
    plan.paidInstallments += 1;

    // Check if plan is completed
    const totalAmountNum = typeof plan.totalAmount === 'string'
      ? parseFloat(plan.totalAmount)
      : Number(plan.totalAmount);
    const paidAmountNum = typeof plan.paidAmount === 'string'
      ? parseFloat(plan.paidAmount)
      : Number(plan.paidAmount);
    if (plan.paidInstallments >= plan.totalInstallments || paidAmountNum >= totalAmountNum) {
      plan.status = PaymentPlanStatus.COMPLETED;
      plan.endDate = new Date();
      plan.nextPaymentDate = null;
    } else {
      // Calculate next payment date
      plan.nextPaymentDate = this.calculateNextPaymentDate(
        new Date(),
        plan.frequency,
      );
    }

    return this.paymentPlanRepository.save(plan);
  }

  /**
   * Cancel a payment plan.
   */
  async cancelPaymentPlan(tenantId: string, planId: string): Promise<SubscriptionPaymentPlan> {
    const plan = await this.paymentPlanRepository.findOne({
      where: { id: planId, tenantId },
    });
    if (!plan) throw new NotFoundException('Payment plan not found');

    plan.status = PaymentPlanStatus.CANCELLED;
    plan.endDate = new Date();
    plan.nextPaymentDate = null;
    return this.paymentPlanRepository.save(plan);
  }

  private calculateNextPaymentDate(
    fromDate: Date,
    frequency: PaymentPlanFrequency,
  ): Date {
    const date = new Date(fromDate);
    switch (frequency) {
      case PaymentPlanFrequency.WEEKLY:
        date.setDate(date.getDate() + 7);
        break;
      case PaymentPlanFrequency.BIWEEKLY:
        date.setDate(date.getDate() + 14);
        break;
      case PaymentPlanFrequency.MONTHLY:
        date.setMonth(date.getMonth() + 1);
        break;
    }
    return date;
  }

  // ── Transaction Fee Transparency (Phase 4) ────────────────────────

  /**
   * Calculate processing fees for different payment method types.
   * Returns the fee breakdown for the current subscription price.
   */
  async getFeeEstimate(tenantId: string): Promise<{
    cardFee: number;
    achFee: number;
    currentMethodFee: number;
    potentialSavings: number;
    feeBreakdown: {
      method: string;
      rate: string;
      fixedFee: string;
      estimatedFee: number;
      estimatedNet: number;
    }[];
  }> {
    const subscription = await this.getSubscription(tenantId);
    const amountCents = subscription.priceCents;
    const amount = amountCents / 100;

    // Standard Stripe processing rates
    const CARD_RATE = 0.029; // 2.9%
    const CARD_FIXED = 0.30; // $0.30
    const ACH_RATE = 0.008; // 0.8%
    const ACH_FIXED = 0.0;
    const ACH_MAX_FEE = 5.0; // Cap at $5 for ACH

    const cardFee = Math.round((amount * CARD_RATE + CARD_FIXED) * 100) / 100;
    const achFee = Math.min(amount * ACH_RATE + ACH_FIXED, ACH_MAX_FEE);

    // Determine current method fee
    const defaultPm = await this.paymentMethodRepository.findOne({
      where: { tenantId, isDefault: true },
    });

    let currentMethodFee = cardFee;
    if (defaultPm?.type === 'us_bank_account') {
      currentMethodFee = achFee;
    }

    const potentialSavings = Math.round((cardFee - achFee) * 100) / 100;

    return {
      cardFee,
      achFee,
      currentMethodFee,
      potentialSavings: Math.max(0, potentialSavings),
      feeBreakdown: [
        {
          method: 'Credit/Debit Card',
          rate: '2.9% + $0.30',
          fixedFee: '$0.30',
          estimatedFee: cardFee,
          estimatedNet: Math.round((amount - cardFee) * 100) / 100,
        },
        {
          method: 'ACH Bank Transfer',
          rate: '0.8% (max $5.00)',
          fixedFee: '$0.00',
          estimatedFee: achFee,
          estimatedNet: Math.round((amount - achFee) * 100) / 100,
        },
      ],
    };
  }

  // ── AI-Driven Payment Optimization (Phase 4) ──────────────────────

  /**
   * Generate AI-driven payment optimization suggestions.
   * Analyzes the tenant's payment methods, subscription, and history
   * to recommend cost-saving actions.
   */
  async getPaymentOptimizationSuggestions(tenantId: string): Promise<{
    suggestions: {
      type: 'switch_to_ach' | 'add_backup_card' | 'update_expired_card' | 'annual_billing' | 'remove_unused_method';
      priority: 'high' | 'medium' | 'low';
      title: string;
      description: string;
      potentialSavings?: number;
      actionUrl: string;
      actionLabel: string;
    }[];
  }> {
    const suggestions: any[] = [];
    const subscription = await this.getSubscription(tenantId);
    const paymentMethods = await this.paymentMethodRepository.find({
      where: { tenantId },
    });
    const feeEstimate = await this.getFeeEstimate(tenantId);

    // 1. Suggest switching to ACH if currently using card
    const defaultPm = paymentMethods.find((pm) => pm.isDefault);
    if (defaultPm?.type === 'card' && feeEstimate.potentialSavings > 0) {
      const annualSavings = feeEstimate.potentialSavings * (subscription.billingCycle === 'annual' ? 12 : 12);
      suggestions.push({
        type: 'switch_to_ach',
        priority: 'medium',
        title: 'Switch to ACH to save on processing fees',
        description: `You could save approximately $${feeEstimate.potentialSavings}/month ($${annualSavings.toFixed(2)}/year) by switching to ACH bank transfer. ACH has lower processing fees (0.8% vs 2.9% + $0.30 for cards).`,
        potentialSavings: annualSavings,
        actionUrl: '/settings?tab=billing',
        actionLabel: 'Add Bank Account',
      });
    }

    // 2. Suggest adding a backup card if only one payment method
    if (paymentMethods.length === 1) {
      suggestions.push({
        type: 'add_backup_card',
        priority: 'low',
        title: 'Add a backup payment method',
        description: 'Having a backup payment method prevents service interruption if your primary card is declined, expired, or lost.',
        actionUrl: '/settings?tab=billing',
        actionLabel: 'Add Payment Method',
      });
    }

    // 3. Check for expired cards
    const { expired } = await this.checkCardExpiry(tenantId);
    for (const pm of expired) {
      suggestions.push({
        type: 'update_expired_card',
        priority: 'high',
        title: `Update expired ${pm.cardBrand} card`,
        description: `Your ${pm.cardBrand} card ending in ${pm.cardLast4} has expired. Update it to avoid payment failures.`,
        actionUrl: '/settings?tab=billing',
        actionLabel: 'Update Card',
      });
    }

    // 4. Suggest annual billing if on monthly
    if (subscription.billingCycle === 'monthly') {
      const { plan } = await this.getSubscriptionWithPlan(tenantId);
      const monthlyAnnual = plan.priceAnnualCents;
      const monthlyTotal = plan.priceMonthlyCents * 12;
      const annualSavings = (monthlyTotal - monthlyAnnual) / 100;
      if (annualSavings > 0) {
        suggestions.push({
          type: 'annual_billing',
          priority: 'low',
          title: 'Switch to annual billing and save 15%',
          description: `Switch to annual billing to save $${annualSavings.toFixed(2)}/year. You'll be billed once per year instead of monthly.`,
          potentialSavings: annualSavings,
          actionUrl: '/settings?tab=billing',
          actionLabel: 'Switch to Annual',
        });
      }
    }

    // 5. Suggest removing unused non-default payment methods
    const nonDefaultMethods = paymentMethods.filter((pm) => !pm.isDefault);
    if (nonDefaultMethods.length > 2) {
      suggestions.push({
        type: 'remove_unused_method',
        priority: 'low',
        title: 'Remove unused payment methods',
        description: `You have ${nonDefaultMethods.length} non-default payment methods. Consider removing ones you no longer use to keep your billing clean.`,
        actionUrl: '/settings?tab=billing',
        actionLabel: 'Manage Payment Methods',
      });
    }

    // Sort by priority
    const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    suggestions.sort(
      (a, b) => priorityOrder[a.priority as string] - priorityOrder[b.priority as string],
    );

    return { suggestions };
  }

  // ── Private helpers for payment methods ───────────────────────────

  /**
   * Sync payment methods from Stripe provider into the local DB.
   */
  private async syncPaymentMethodsFromProvider(
    tenantId: string,
    stripeCustomerId: string,
  ): Promise<void> {
    const providerMethods = await this.subscriptionProvider.getPaymentMethods({
      stripeCustomerId,
    });

    const existingMethods = await this.paymentMethodRepository.find({
      where: { tenantId },
    });

    // Build a map of existing methods by Stripe PM ID
    const existingMap = new Map(existingMethods.map((m) => [m.stripePaymentMethodId, m]));

    // Upsert each provider method
    for (const details of providerMethods) {
      const existing = existingMap.get(details.stripePaymentMethodId);
      if (existing) {
        // Update existing
        existing.cardBrand = (details.cardBrand as CardBrand) ?? existing.cardBrand;
        existing.cardLast4 = details.cardLast4 ?? existing.cardLast4;
        existing.cardExpMonth = details.cardExpMonth ?? existing.cardExpMonth;
        existing.cardExpYear = details.cardExpYear ?? existing.cardExpYear;
        existing.cardFunding = details.cardFunding ?? existing.cardFunding;
        existing.bankName = details.bankName ?? existing.bankName;
        existing.bankLast4 = details.bankLast4 ?? existing.bankLast4;
        existing.bankAccountType = details.bankAccountType ?? existing.bankAccountType;
        existing.billingName = details.billingName ?? existing.billingName;
        existing.billingAddress = details.billingAddress ?? existing.billingAddress;
        existing.isDefault = details.isDefault ?? existing.isDefault;
        existing.isHsaFsa = details.isHsaFsa ?? existing.isHsaFsa;
        await this.paymentMethodRepository.save(existing);
        existingMap.delete(details.stripePaymentMethodId);
      } else {
        // Create new
        const entity = this.paymentMethodRepository.create(
          this.mapPaymentMethodDetailsToEntity(tenantId, details),
        );
        await this.paymentMethodRepository.save(entity);
      }
    }

    // Remove methods that no longer exist in Stripe
    for (const [, staleMethod] of existingMap) {
      await this.paymentMethodRepository.remove(staleMethod);
    }
  }

  private mapPaymentMethodDetailsToEntity(
    tenantId: string,
    details: PaymentMethodDetails,
  ): Partial<SubscriptionPaymentMethod> {
    return {
      tenantId,
      stripePaymentMethodId: details.stripePaymentMethodId,
      type: (details.type as PaymentMethodType) ?? PaymentMethodType.CARD,
      cardBrand: (details.cardBrand as CardBrand) ?? null,
      cardLast4: details.cardLast4 ?? null,
      cardExpMonth: details.cardExpMonth ?? null,
      cardExpYear: details.cardExpYear ?? null,
      cardFunding: details.cardFunding ?? null,
      bankName: details.bankName ?? null,
      bankLast4: details.bankLast4 ?? null,
      bankAccountType: details.bankAccountType ?? null,
      billingName: details.billingName ?? null,
      billingAddress: details.billingAddress ?? null,
      isDefault: details.isDefault ?? false,
      isHsaFsa: details.isHsaFsa ?? false,
      metadata: details.metadata ?? {},
    };
  }
}
