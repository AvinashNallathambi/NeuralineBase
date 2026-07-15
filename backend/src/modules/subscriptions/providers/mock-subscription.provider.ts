import { Injectable, Logger } from '@nestjs/common';
import {
  SubscriptionProvider,
  CreateSubscriptionRequest,
  CreateSubscriptionResponse,
  CancelSubscriptionRequest,
  CancelSubscriptionResponse,
  ChangePlanRequest,
  ChangePlanResponse,
  SubscriptionWebhookEvent,
} from './subscription-provider.interface';

/**
 * Mock subscription provider for development without Stripe.
 * Simulates a 14-day trial then active subscription.
 */
@Injectable()
export class MockSubscriptionProvider implements SubscriptionProvider {
  readonly name = 'mock';
  private readonly logger = new Logger(MockSubscriptionProvider.name);

  async createSubscription(request: CreateSubscriptionRequest): Promise<CreateSubscriptionResponse> {
    const now = new Date();
    const trialEnd = new Date(now.getTime() + (request.trialDays ?? 14) * 24 * 60 * 60 * 1000);
    const periodEnd =
      request.billingCycle === 'annual'
        ? new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)
        : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    this.logger.log(
      `Mock subscription created for tenant ${request.tenantName} (plan: ${request.planTier}, cycle: ${request.billingCycle})`,
    );

    return {
      providerSubscriptionId: `mock_sub_${request.subscriptionId.substring(0, 8)}`,
      providerCustomerId: `mock_cus_${request.tenantId.substring(0, 8)}`,
      status: 'trialing',
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      trialEnd,
    };
  }

  async cancelSubscription(
    request: CancelSubscriptionRequest,
  ): Promise<CancelSubscriptionResponse> {
    this.logger.log(`Mock subscription ${request.providerSubscriptionId} cancelled`);
    return {
      status: 'canceled',
      cancelAtPeriodEnd: request.cancelAtPeriodEnd ?? false,
      canceledAt: request.cancelAtPeriodEnd ? null : new Date(),
    };
  }

  async changePlan(request: ChangePlanRequest): Promise<ChangePlanResponse> {
    this.logger.log(`Mock subscription ${request.providerSubscriptionId} plan changed`);
    return {
      providerSubscriptionId: request.providerSubscriptionId,
      status: 'active',
    };
  }

  parseWebhook(rawBody: string, _signature: string): SubscriptionWebhookEvent {
    const event = JSON.parse(rawBody) as Record<string, any>;
    const obj = event.data?.object ?? {};
    return {
      providerSubscriptionId: obj.id ?? '',
      status: obj.status ?? 'active',
      currentPeriodStart: obj.current_period_start
        ? new Date(obj.current_period_start * 1000)
        : undefined,
      currentPeriodEnd: obj.current_period_end
        ? new Date(obj.current_period_end * 1000)
        : undefined,
      trialEnd: obj.trial_end ? new Date(obj.trial_end * 1000) : null,
      rawEvent: event,
    };
  }
}
