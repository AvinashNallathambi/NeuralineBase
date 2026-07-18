import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan } from 'typeorm';
import { NotificationsService } from '../notifications/notifications.service';
import {
  Notification,
  NotificationType,
  NotificationPriority,
} from '../notifications/entities/notification.entity';
import {
  Subscription,
  SubscriptionStatus,
} from './entities/subscription.entity';
import { SubscriptionPlan } from './entities/subscription-plan.entity';
import {
  SubscriptionPaymentMethod,
  PaymentMethodType,
} from './entities/payment-method.entity';

const GRACE_PERIOD_DAYS = 14; // Healthcare context: 14-day grace period

/**
 * Handles all subscription lifecycle notifications:
 * - Trial expiration sequence (Day 7, Day 11, Day 14)
 * - Payment failure / dunning sequence (Day 0, 3, 7, 14)
 * - Renewal reminders (30, 14, 7, 3 days before)
 * - Post-expiry win-back (Day 3, 7, 14 after)
 *
 * Called by:
 * - SubscriptionSchedulerService (daily cron via Bull queue)
 * - SubscriptionsService.handleWebhook (event-driven)
 */
@Injectable()
export class SubscriptionNotificationService {
  private readonly logger = new Logger(SubscriptionNotificationService.name);

  constructor(
    @InjectRepository(Subscription)
    private subscriptionRepository: Repository<Subscription>,
    @InjectRepository(SubscriptionPlan)
    private planRepository: Repository<SubscriptionPlan>,
    @InjectRepository(SubscriptionPaymentMethod)
    private paymentMethodRepository: Repository<SubscriptionPaymentMethod>,
    private notificationsService: NotificationsService,
  ) {}

  // ── Daily Cron Job: Check all subscriptions for notification triggers ──

  /**
   * Called daily by the scheduler. Scans all subscriptions and sends
   * appropriate notifications based on trial status, renewal dates, and
   * payment failures.
   */
  async runDailyCheck(): Promise<void> {
    this.logger.log('Running daily subscription notification check...');

    await this.checkTrialExpirations();
    await this.checkUpcomingRenewals();
    await this.checkFailedPayments();
    await this.checkExpiredSubscriptions();
    await this.checkCardExpirations();

    this.logger.log('Daily subscription notification check complete.');
  }

  // ── Trial Expiration Sequence ──────────────────────────────────────

  /**
   * Trial notification sequence (14-day trial):
   * - Day 7 (7 days before end): Soft reminder
   * - Day 11 (3 days before end): Value recap + urgency
   * - Day 14 (day of expiration): Final call
   * - Day 14+ (after expiration): Trial expired + grace period notice
   */
  private async checkTrialExpirations(): Promise<void> {
    const trialingSubs = await this.subscriptionRepository.find({
      where: { status: SubscriptionStatus.TRIALING },
    });

    for (const sub of trialingSubs) {
      if (!sub.trialEndsAt) continue;

      const daysLeft = this.daysUntil(sub.trialEndsAt);
      const plan = await this.getPlan(sub.planTier);
      const tenantEmail = await this.getTenantEmail(sub);

      // Day 7: Soft reminder (7 days before)
      if (daysLeft === 7) {
        await this.sendIfNotAlreadySent(sub, NotificationType.TRIAL_ENDING, 24, () =>
          this.notificationsService.notify({
            tenantId: sub.tenantId,
            type: NotificationType.TRIAL_ENDING,
            title: 'Your free trial ends in 7 days',
            message: `Your ${plan.name} plan trial expires on ${this.formatDate(sub.trialEndsAt!)}. Add a payment method to continue your subscription without interruption.`,
            priority: NotificationPriority.MEDIUM,
            actionUrl: '/subscriptions',
            actionLabel: 'Add Payment Method',
            sendEmail: !!tenantEmail,
            emailTo: tenantEmail ?? undefined,
            emailToName: sub.metadata?.tenantName as string | undefined,
            metadata: { daysLeft, planTier: sub.planTier, trialEndsAt: sub.trialEndsAt },
          }),
        );
      }

      // Day 3: Value recap + urgency (3 days before)
      if (daysLeft === 3) {
        await this.sendIfNotAlreadySent(sub, NotificationType.TRIAL_ENDING, 24, () =>
          this.notificationsService.notify({
            tenantId: sub.tenantId,
            type: NotificationType.TRIAL_ENDING,
            title: '3 days left in your trial',
            message: `Your ${plan.name} trial ends in 3 days. Don't lose access to your patient records, claims, and AI features. Add a payment method now to keep everything running smoothly.`,
            priority: NotificationPriority.HIGH,
            actionUrl: '/subscriptions',
            actionLabel: 'Upgrade Now',
            sendEmail: !!tenantEmail,
            emailTo: tenantEmail ?? undefined,
            emailToName: sub.metadata?.tenantName as string | undefined,
            metadata: { daysLeft, planTier: sub.planTier, trialEndsAt: sub.trialEndsAt },
          }),
        );
      }

      // Day 0: Trial expired → transition to grace period
      if (daysLeft <= 0) {
        // Mark trial as expired, enter grace period
        sub.status = SubscriptionStatus.PAST_DUE; // Grace period = past_due
        sub.metadata = { ...sub.metadata, gracePeriodEndsAt: this.addDays(new Date(), GRACE_PERIOD_DAYS) };
        await this.subscriptionRepository.save(sub);

        await this.sendIfNotAlreadySent(sub, NotificationType.TRIAL_EXPIRED, 24, () =>
          this.notificationsService.notify({
            tenantId: sub.tenantId,
            type: NotificationType.TRIAL_EXPIRED,
            title: 'Your free trial has ended',
            message: `Your ${plan.name} trial ended on ${this.formatDate(sub.trialEndsAt!)}. You have a ${GRACE_PERIOD_DAYS}-day grace period to add a payment method. After that, your account will be suspended. Your data is safe.`,
            priority: NotificationPriority.URGENT,
            actionUrl: '/subscriptions',
            actionLabel: 'Add Payment Method',
            sendEmail: !!tenantEmail,
            emailTo: tenantEmail ?? undefined,
            emailToName: sub.metadata?.tenantName as string | undefined,
            metadata: { gracePeriodDays: GRACE_PERIOD_DAYS, planTier: sub.planTier },
          }),
        );
      }
    }
  }

  // ── Renewal Reminders ──────────────────────────────────────────────

  /**
   * Renewal reminder sequence:
   * - 30 days before: Early awareness
   * - 14 days before: Value recap
   * - 7 days before: Moderate urgency
   * - 3 days before: High urgency
   * - 1 day before: Final reminder
   */
  private async checkUpcomingRenewals(): Promise<void> {
    const activeSubs = await this.subscriptionRepository.find({
      where: { status: SubscriptionStatus.ACTIVE },
    });

    for (const sub of activeSubs) {
      if (!sub.currentPeriodEnd || sub.cancelAtPeriodEnd) continue;

      const daysLeft = this.daysUntil(sub.currentPeriodEnd);
      const plan = await this.getPlan(sub.planTier);
      const tenantEmail = await this.getTenantEmail(sub);

      const reminderDays = [30, 14, 7, 3, 1];
      if (!reminderDays.includes(daysLeft)) continue;

      const urgencyMap: Record<number, NotificationPriority> = {
        30: NotificationPriority.LOW,
        14: NotificationPriority.MEDIUM,
        7: NotificationPriority.MEDIUM,
        3: NotificationPriority.HIGH,
        1: NotificationPriority.HIGH,
      };

      const messageMap: Record<number, string> = {
        30: `Your ${plan.name} subscription renews on ${this.formatDate(sub.currentPeriodEnd!)}. This is a friendly reminder for your budget planning.`,
        14: `Your ${plan.name} subscription renews in 14 days (${this.formatDate(sub.currentPeriodEnd!)}). You can update your payment method or change your plan anytime.`,
        7: `Your ${plan.name} subscription renews in 7 days. Make sure your payment method is up to date to avoid any interruption.`,
        3: `Your ${plan.name} subscription renews in 3 days on ${this.formatDate(sub.currentPeriodEnd!)}. Please verify your payment method is current.`,
        1: `Your ${plan.name} subscription renews tomorrow. This is your final reminder before the renewal charge.`,
      };

      await this.sendIfNotAlreadySent(sub, NotificationType.RENEWAL_UPCOMING, 20, () =>
        this.notificationsService.notify({
          tenantId: sub.tenantId,
          type: NotificationType.RENEWAL_UPCOMING,
          title: `Subscription renews in ${daysLeft} day${daysLeft > 1 ? 's' : ''}`,
          message: messageMap[daysLeft],
          priority: urgencyMap[daysLeft],
          actionUrl: '/subscriptions',
          actionLabel: 'Manage Subscription',
          sendEmail: !!tenantEmail,
          emailTo: tenantEmail ?? undefined,
          emailToName: sub.metadata?.tenantName as string | undefined,
          metadata: { daysLeft, planTier: sub.planTier, renewalDate: sub.currentPeriodEnd },
        }),
      );
    }
  }

  // ── Payment Failure / Dunning Sequence ─────────────────────────────

  /**
   * Dunning sequence for past_due subscriptions:
   * - Day 0: Friendly "we had trouble" notification
   * - Day 3: Value-based reminder
   * - Day 7: Urgency escalation
   * - Day 14: Final notice before suspension
   *
   * Grace period: 14 days (healthcare context).
   * After grace period: account suspended (status → expired).
   */
  private async checkFailedPayments(): Promise<void> {
    const pastDueSubs = await this.subscriptionRepository.find({
      where: { status: SubscriptionStatus.PAST_DUE },
    });

    for (const sub of pastDueSubs) {
      // Calculate days since the subscription became past_due
      // We use updatedAt as a proxy for when the status changed
      const daysSinceFailure = this.daysSince(sub.updatedAt);
      const plan = await this.getPlan(sub.planTier);
      const tenantEmail = await this.getTenantEmail(sub);

      // Skip if this is a trial-expired grace period (handled by trial logic)
      if (sub.metadata?.gracePeriodEndsAt) {
        const graceEnd = new Date(sub.metadata.gracePeriodEndsAt as string);
        const daysLeftInGrace = this.daysUntil(graceEnd);

        if (daysLeftInGrace <= 0) {
          // Grace period expired → suspend account
          sub.status = SubscriptionStatus.EXPIRED;
          await this.subscriptionRepository.save(sub);

          await this.notificationsService.notify({
            tenantId: sub.tenantId,
            type: NotificationType.ACCOUNT_SUSPENDED,
            title: 'Your account has been suspended',
            message: `Your ${plan.name} subscription grace period has ended and no payment method was added. Your account is now suspended. Your data is preserved for 30 days. Add a payment method to reactivate.`,
            priority: NotificationPriority.URGENT,
            actionUrl: '/subscriptions',
            actionLabel: 'Reactivate Account',
            sendEmail: !!tenantEmail,
            emailTo: tenantEmail ?? undefined,
            emailToName: sub.metadata?.tenantName as string | undefined,
            metadata: { planTier: sub.planTier, suspendedAt: new Date() },
          });
        }
        continue;
      }

      // Standard dunning sequence (payment failure, not trial expiry)
      const dunningDays = [0, 3, 7, 14];
      if (!dunningDays.includes(daysSinceFailure)) continue;

      const dunningMessages: Record<number, { title: string; message: string; priority: NotificationPriority }> = {
        0: {
          title: 'We had trouble processing your payment',
          message: `Your payment for the ${plan.name} plan could not be processed. Please update your payment method. You have a ${GRACE_PERIOD_DAYS}-day grace period before your account is suspended.`,
          priority: NotificationPriority.HIGH,
        },
        3: {
          title: 'Payment action needed — 3 days',
          message: `Your ${plan.name} subscription payment is still outstanding. Please update your payment method to avoid service interruption. Your data is safe.`,
          priority: NotificationPriority.HIGH,
        },
        7: {
          title: 'Final reminder before account suspension',
          message: `Your ${plan.name} payment is ${daysSinceFailure} days overdue. Your account will be suspended in ${GRACE_PERIOD_DAYS - daysSinceFailure} days. Update your payment method now.`,
          priority: NotificationPriority.URGENT,
        },
        14: {
          title: 'Account suspension in 24 hours',
          message: `This is your final notice. Your ${plan.name} subscription will be suspended tomorrow due to non-payment. Add a payment method immediately to prevent losing access.`,
          priority: NotificationPriority.URGENT,
        },
      };

      const msg = dunningMessages[daysSinceFailure];
      if (msg) {
        await this.sendIfNotAlreadySent(sub, NotificationType.DUNNING_REMINDER, 20, () =>
          this.notificationsService.notify({
            tenantId: sub.tenantId,
            type: NotificationType.DUNNING_REMINDER,
            title: msg.title,
            message: msg.message,
            priority: msg.priority,
            actionUrl: '/subscriptions',
            actionLabel: 'Update Payment Method',
            sendEmail: !!tenantEmail,
            emailTo: tenantEmail ?? undefined,
            emailToName: sub.metadata?.tenantName as string | undefined,
            metadata: { daysSinceFailure, planTier: sub.planTier, gracePeriodDays: GRACE_PERIOD_DAYS },
          }),
        );
      }
    }
  }

  // ── Post-Expiry Win-Back ───────────────────────────────────────────

  /**
   * Win-back sequence for expired/cancelled subscriptions:
   * - Day 3 after expiry: "Your data is safe" + soft re-engagement
   * - Day 7 after expiry: Highlight features
   * - Day 14 after expiry: Final offer / feedback request
   */
  private async checkExpiredSubscriptions(): Promise<void> {
    const expiredSubs = await this.subscriptionRepository.find({
      where: { status: SubscriptionStatus.EXPIRED },
    });

    for (const sub of expiredSubs) {
      const expiryDate = sub.cancelledAt ?? sub.updatedAt;
      const daysSinceExpiry = this.daysSince(expiryDate);
      const plan = await this.getPlan(sub.planTier);
      const tenantEmail = await this.getTenantEmail(sub);

      const winBackDays = [3, 7, 14];
      if (!winBackDays.includes(daysSinceExpiry)) continue;

      const winBackMessages: Record<number, { title: string; message: string }> = {
        3: {
          title: 'Your subscription has ended, but your data is safe',
          message: `Your ${plan.name} subscription ended ${daysSinceExpiry} days ago. Your data is preserved for 30 days. Reactivate anytime to restore full access.`,
        },
        7: {
          title: 'We miss you at Neuraline',
          message: `It's been a week since your ${plan.name} subscription ended. We've added new features and improvements. Come back and see what's new.`,
        },
        14: {
          title: 'Last chance to restore your account',
          message: `Your data will be permanently deleted in 16 days. Reactivate your ${plan.name} subscription now to keep your patient records, claims, and clinical notes.`,
        },
      };

      const msg = winBackMessages[daysSinceExpiry];
      if (msg) {
        await this.sendIfNotAlreadySent(sub, NotificationType.GENERAL, 20, () =>
          this.notificationsService.notify({
            tenantId: sub.tenantId,
            type: NotificationType.GENERAL,
            title: msg.title,
            message: msg.message,
            priority: NotificationPriority.MEDIUM,
            actionUrl: '/subscriptions',
            actionLabel: 'Reactivate',
            sendEmail: !!tenantEmail,
            emailTo: tenantEmail ?? undefined,
            emailToName: sub.metadata?.tenantName as string | undefined,
            metadata: { daysSinceExpiry, planTier: sub.planTier, winBack: true },
          }),
        );
      }
    }
  }

  // ── Card Expiry Notifications (Phase 2) ────────────────────────────

  /**
   * Checks all card payment methods for upcoming or past expiry.
   * Sends notifications:
   * - 60 days before expiry: Early notice
   * - 30 days before expiry: Urgent update
   * - Expired: Critical alert
   */
  private async checkCardExpirations(): Promise<void> {
    const cardMethods = await this.paymentMethodRepository.find({
      where: { type: PaymentMethodType.CARD },
    });

    const now = new Date();

    for (const pm of cardMethods) {
      if (!pm.cardExpMonth || !pm.cardExpYear) continue;

      // Card expires at the end of the expiry month
      const expDate = new Date(pm.cardExpYear, pm.cardExpMonth, 1);
      expDate.setMonth(expDate.getMonth() + 1, 0); // Last day of expiry month

      const daysUntilExpiry = Math.ceil(
        (expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );

      const tenantEmail = await this.getTenantEmailByTenantId(pm.tenantId);

      // Expired
      if (daysUntilExpiry < 0) {
        await this.sendIfNotAlreadySent(
          { id: `pm-expired-${pm.id}` } as Subscription,
          NotificationType.PAYMENT_FAILED,
          168, // 7 days dedup
          () =>
            this.notificationsService.notify({
              tenantId: pm.tenantId,
              type: NotificationType.PAYMENT_FAILED,
              title: 'Your payment card has expired',
              message: `Your ${pm.cardBrand} card ending in ${pm.cardLast4} has expired. Please update your payment method to avoid service interruption.`,
              priority: NotificationPriority.URGENT,
              actionUrl: '/settings?tab=billing',
              actionLabel: 'Update Payment Method',
              sendEmail: !!tenantEmail,
              emailTo: tenantEmail ?? undefined,
              metadata: { cardLast4: pm.cardLast4, cardBrand: pm.cardBrand, expired: true },
            }),
        );
      }
      // 30 days before expiry
      else if (daysUntilExpiry <= 30 && daysUntilExpiry > 0) {
        await this.sendIfNotAlreadySent(
          { id: `pm-expiring-30-${pm.id}` } as Subscription,
          NotificationType.RENEWAL_UPCOMING,
          168,
          () =>
            this.notificationsService.notify({
              tenantId: pm.tenantId,
              type: NotificationType.RENEWAL_UPCOMING,
              title: `Your card expires in ${daysUntilExpiry} days`,
              message: `Your ${pm.cardBrand} card ending in ${pm.cardLast4} will expire on ${pm.cardExpMonth}/${pm.cardExpYear}. Please update your payment method before it expires to avoid any billing interruption.`,
              priority: NotificationPriority.HIGH,
              actionUrl: '/settings?tab=billing',
              actionLabel: 'Update Payment Method',
              sendEmail: !!tenantEmail,
              emailTo: tenantEmail ?? undefined,
              metadata: {
                cardLast4: pm.cardLast4,
                cardBrand: pm.cardBrand,
                expMonth: pm.cardExpMonth,
                expYear: pm.cardExpYear,
                daysUntilExpiry,
              },
            }),
        );
      }
      // 60 days before expiry
      else if (daysUntilExpiry <= 60 && daysUntilExpiry > 30) {
        await this.sendIfNotAlreadySent(
          { id: `pm-expiring-60-${pm.id}` } as Subscription,
          NotificationType.RENEWAL_UPCOMING,
          168,
          () =>
            this.notificationsService.notify({
              tenantId: pm.tenantId,
              type: NotificationType.RENEWAL_UPCOMING,
              title: 'Your card expires soon',
              message: `Your ${pm.cardBrand} card ending in ${pm.cardLast4} will expire on ${pm.cardExpMonth}/${pm.cardExpYear}. Consider updating your payment method at your convenience.`,
              priority: NotificationPriority.MEDIUM,
              actionUrl: '/settings?tab=billing',
              actionLabel: 'Update Payment Method',
              sendEmail: !!tenantEmail,
              emailTo: tenantEmail ?? undefined,
              metadata: {
                cardLast4: pm.cardLast4,
                cardBrand: pm.cardBrand,
                expMonth: pm.cardExpMonth,
                expYear: pm.cardExpYear,
                daysUntilExpiry,
              },
            }),
        );
      }
    }
  }

  // ── Webhook-Triggered Notifications (event-driven) ─────────────────

  /**
   * Called when Stripe sends `invoice.payment_failed` webhook.
   * Sends immediate notification + starts dunning sequence.
   */
  async onPaymentFailed(subscription: Subscription): Promise<void> {
    const plan = await this.getPlan(subscription.planTier);
    const tenantEmail = await this.getTenantEmail(subscription);

    await this.notificationsService.notify({
      tenantId: subscription.tenantId,
      type: NotificationType.PAYMENT_FAILED,
      title: 'Payment failed — action needed',
      message: `Your payment for the ${plan.name} plan could not be processed. We'll automatically retry. Please update your payment method to avoid interruption. You have a ${GRACE_PERIOD_DAYS}-day grace period.`,
      priority: NotificationPriority.URGENT,
      actionUrl: '/subscriptions',
      actionLabel: 'Update Payment Method',
      sendEmail: !!tenantEmail,
      emailTo: tenantEmail ?? undefined,
      emailToName: subscription.metadata?.tenantName as string | undefined,
      metadata: { planTier: subscription.planTier, gracePeriodDays: GRACE_PERIOD_DAYS },
    });
  }

  /**
   * Called when Stripe sends `invoice.payment_succeeded` webhook.
   * Sends confirmation notification.
   */
  async onPaymentSucceeded(subscription: Subscription, amount?: number): Promise<void> {
    const plan = await this.getPlan(subscription.planTier);
    const tenantEmail = await this.getTenantEmail(subscription);

    await this.notificationsService.notify({
      tenantId: subscription.tenantId,
      type: NotificationType.PAYMENT_SUCCEEDED,
      title: 'Payment successful',
      message: `Your payment of ${amount ? `$${amount.toFixed(2)}` : 'the subscription fee'} for the ${plan.name} plan was processed successfully. Your subscription is active until ${this.formatDate(subscription.currentPeriodEnd)}.`,
      priority: NotificationPriority.LOW,
      actionUrl: '/subscriptions',
      actionLabel: 'View Subscription',
      sendEmail: !!tenantEmail,
      emailTo: tenantEmail ?? undefined,
      emailToName: subscription.metadata?.tenantName as string | undefined,
      metadata: { planTier: subscription.planTier, amount },
    });
  }

  /**
   * Called when a plan is changed (upgrade/downgrade).
   */
  async onPlanChanged(
    subscription: Subscription,
    oldPlanTier: string,
    newPlanTier: string,
  ): Promise<void> {
    const newPlan = await this.getPlan(newPlanTier);
    const tenantEmail = await this.getTenantEmail(subscription);

    const isUpgrade = this.isUpgrade(oldPlanTier, newPlanTier);

    await this.notificationsService.notify({
      tenantId: subscription.tenantId,
      type: NotificationType.PLAN_CHANGED,
      title: isUpgrade ? `Upgraded to ${newPlan.name}` : `Switched to ${newPlan.name}`,
      message: isUpgrade
        ? `You've been upgraded to the ${newPlan.name} plan. You now have access to additional features. Your subscription is active until ${this.formatDate(subscription.currentPeriodEnd)}.`
        : `Your plan has been changed to ${newPlan.name}. The new rate will take effect on your next billing cycle.`,
      priority: NotificationPriority.MEDIUM,
      actionUrl: '/subscriptions',
      actionLabel: 'View Subscription',
      sendEmail: !!tenantEmail,
      emailTo: tenantEmail ?? undefined,
      emailToName: subscription.metadata?.tenantName as string | undefined,
      metadata: { oldPlanTier, newPlanTier, isUpgrade },
    });
  }

  /**
   * Called when a subscription is cancelled.
   */
  async onSubscriptionCancelled(
    subscription: Subscription,
    cancelAtPeriodEnd: boolean,
  ): Promise<void> {
    const plan = await this.getPlan(subscription.planTier);
    const tenantEmail = await this.getTenantEmail(subscription);

    await this.notificationsService.notify({
      tenantId: subscription.tenantId,
      type: NotificationType.SUBSCRIPTION_CANCELLED,
      title: cancelAtPeriodEnd ? 'Subscription cancellation scheduled' : 'Subscription cancelled',
      message: cancelAtPeriodEnd
        ? `Your ${plan.name} subscription will be cancelled on ${this.formatDate(subscription.currentPeriodEnd)}. You'll have full access until then. You can reactivate anytime before that date.`
        : `Your ${plan.name} subscription has been cancelled. Your data is preserved for 30 days. You can reactivate anytime from the Subscription page.`,
      priority: NotificationPriority.HIGH,
      actionUrl: '/subscriptions',
      actionLabel: 'Reactivate',
      sendEmail: !!tenantEmail,
      emailTo: tenantEmail ?? undefined,
      emailToName: subscription.metadata?.tenantName as string | undefined,
      metadata: { planTier: subscription.planTier, cancelAtPeriodEnd },
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────

  private async getPlan(tier: string): Promise<SubscriptionPlan> {
    const plan = await this.planRepository.findOne({ where: { tier: tier as any } });
    if (!plan) {
      // Fallback to a minimal plan object if not found
      return { name: tier, tier: tier as any } as SubscriptionPlan;
    }
    return plan;
  }

  private async getTenantEmail(sub: Subscription): Promise<string | null> {
    // In production this would look up the tenant admin's email from the DB.
    // For now, check metadata or return null (mock mode).
    return (sub.metadata?.tenantEmail as string) ?? null;
  }

  private async getTenantEmailByTenantId(tenantId: string): Promise<string | null> {
    const sub = await this.subscriptionRepository.findOne({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
    if (!sub) return null;
    return this.getTenantEmail(sub);
  }

  private async sendIfNotAlreadySent(
    sub: Subscription,
    type: NotificationType,
    withinHours: number,
    sendFn: () => Promise<Notification>,
  ): Promise<void> {
    const alreadySent = await this.notificationsService.wasRecentlyNotified(
      sub.tenantId,
      type,
      withinHours,
    );
    if (alreadySent) {
      this.logger.debug(`Notification ${type} already sent recently for tenant ${sub.tenantId}`);
      return;
    }
    await sendFn();
  }

  private daysUntil(date: Date): number {
    return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }

  private daysSince(date: Date): number {
    return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  }

  private addDays(date: Date, days: number): Date {
    return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
  }

  private formatDate(date: Date | null | undefined): string {
    if (!date) return 'N/A';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  private isUpgrade(oldTier: string, newTier: string): boolean {
    const tierOrder = ['solo', 'professional', 'enterprise'];
    const oldIdx = tierOrder.indexOf(oldTier);
    const newIdx = tierOrder.indexOf(newTier);
    return newIdx > oldIdx;
  }
}
