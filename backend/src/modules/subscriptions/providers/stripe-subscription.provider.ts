import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
 * Stripe subscription provider.
 *
 * Uses the Stripe REST API directly via `fetch` (no SDK dependency).
 * Activate by setting STRIPE_API_KEY in .env. Without a key, the module
 * falls back to MockSubscriptionProvider.
 *
 * Flow:
 * 1. Create a Stripe Customer for the tenant
 * 2. Create a Stripe Subscription with the plan's Stripe Price ID
 * 3. Store the Stripe customer/subscription IDs on the Subscription entity
 * 4. Webhooks update subscription status on renewal/failure/cancellation
 *
 * API Reference: https://stripe.com/docs/api/subscriptions
 */
@Injectable()
export class StripeSubscriptionProvider implements SubscriptionProvider {
  readonly name = 'stripe';
  private readonly logger = new Logger(StripeSubscriptionProvider.name);
  private readonly apiKey: string;
  private readonly webhookSecret: string;
  private readonly baseUrl = 'https://api.stripe.com/v1';

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('STRIPE_API_KEY', '');
    this.webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET', '');
  }

  async createSubscription(request: CreateSubscriptionRequest): Promise<CreateSubscriptionResponse> {
    if (!request.stripePriceId) {
      throw new BadRequestException(
        `No Stripe Price ID configured for plan tier: ${request.planTier}`,
      );
    }

    // 1. Create or retrieve Stripe Customer
    const customer = await this.createCustomer(
      request.tenantId,
      request.tenantName,
      request.tenantEmail,
    );

    // 2. Create Stripe Subscription with trial period
    const params = new URLSearchParams();
    params.append('customer', customer.id);
    params.append('items[0][price]', request.stripePriceId);
    params.append('metadata[subscriptionId]', request.subscriptionId);
    params.append('metadata[tenantId]', request.tenantId);
    params.append('metadata[planTier]', request.planTier);

    if (request.trialDays && request.trialDays > 0) {
      params.append('trial_period_days', request.trialDays.toString());
    }

    this.logger.log(
      `Creating Stripe Subscription for tenant ${request.tenantName} (plan: ${request.planTier})`,
    );

    const response = await fetch(`${this.baseUrl}/subscriptions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const json = (await response.json()) as Record<string, any>;

    if (!response.ok) {
      this.logger.error(`Stripe subscription create failed: ${JSON.stringify(json)}`);
      throw new BadRequestException(
        `Stripe error: ${json.error?.message ?? response.statusText}`,
      );
    }

    return {
      providerSubscriptionId: json.id,
      providerCustomerId: customer.id,
      status: json.status,
      currentPeriodStart: new Date(json.current_period_start * 1000),
      currentPeriodEnd: new Date(json.current_period_end * 1000),
      trialEnd: json.trial_end ? new Date(json.trial_end * 1000) : null,
      hostedInvoiceUrl: json.latest_invoice?.hosted_invoice_url ?? null,
      rawResponse: json,
    };
  }

  async cancelSubscription(
    request: CancelSubscriptionRequest,
  ): Promise<CancelSubscriptionResponse> {
    const params = new URLSearchParams();
    if (request.cancelAtPeriodEnd) {
      params.append('cancel_at_period_end', 'true');
    }

    const url = request.cancelAtPeriodEnd
      ? `${this.baseUrl}/subscriptions/${request.providerSubscriptionId}`
      : `${this.baseUrl}/subscriptions/${request.providerSubscriptionId}?cancel_now=true`;

    const response = await fetch(url, {
      method: request.cancelAtPeriodEnd ? 'POST' : 'DELETE',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: request.cancelAtPeriodEnd ? params.toString() : undefined,
    });

    const json = (await response.json()) as Record<string, any>;

    if (!response.ok) {
      this.logger.error(`Stripe cancel failed: ${JSON.stringify(json)}`);
      throw new BadRequestException(
        `Stripe error: ${json.error?.message ?? response.statusText}`,
      );
    }

    return {
      status: json.status === 'canceled' ? 'canceled' : 'active',
      cancelAtPeriodEnd: json.cancel_at_period_end ?? false,
      canceledAt: json.canceled_at ? new Date(json.canceled_at * 1000) : null,
      rawResponse: json,
    };
  }

  async changePlan(request: ChangePlanRequest): Promise<ChangePlanResponse> {
    // Retrieve the subscription to get the item id
    const subResponse = await fetch(
      `${this.baseUrl}/subscriptions/${request.providerSubscriptionId}`,
      {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      },
    );
    const sub = (await subResponse.json()) as Record<string, any>;

    if (!subResponse.ok) {
      throw new BadRequestException(
        `Stripe error: ${sub.error?.message ?? subResponse.statusText}`,
      );
    }

    const itemId = sub.items?.data?.[0]?.id;
    if (!itemId) {
      throw new BadRequestException('Subscription has no items to update');
    }

    const params = new URLSearchParams();
    params.append(`items[0][id]`, itemId);
    params.append(`items[0][price]`, request.newStripePriceId);
    if (request.prorate === false) {
      params.append('proration_behavior', 'none');
    }

    const response = await fetch(
      `${this.baseUrl}/subscriptions/${request.providerSubscriptionId}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      },
    );

    const json = (await response.json()) as Record<string, any>;

    if (!response.ok) {
      this.logger.error(`Stripe change plan failed: ${JSON.stringify(json)}`);
      throw new BadRequestException(
        `Stripe error: ${json.error?.message ?? response.statusText}`,
      );
    }

    return {
      providerSubscriptionId: json.id,
      status: json.status,
      rawResponse: json,
    };
  }

  parseWebhook(rawBody: string, signature: string): SubscriptionWebhookEvent {
    if (this.webhookSecret && !signature) {
      throw new BadRequestException('Missing Stripe-Signature header');
    }

    const event = JSON.parse(rawBody) as Record<string, any>;
    const obj = event.data?.object ?? {};
    const eventType = (event.type ?? '').toString();

    let status: SubscriptionWebhookEvent['status'] = 'active';
    if (eventType.includes('deleted') || obj.status === 'canceled') {
      status = 'canceled';
    } else if (eventType.includes('past_due') || obj.status === 'past_due') {
      status = 'past_due';
    } else if (eventType.includes('expired') || obj.status === 'expired') {
      status = 'expired';
    } else if (obj.status === 'trialing') {
      status = 'trialing';
    }

    return {
      providerSubscriptionId: obj.id ?? '',
      status,
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

  private async createCustomer(
    tenantId: string,
    tenantName: string,
    tenantEmail: string,
  ): Promise<{ id: string }> {
    const params = new URLSearchParams();
    params.append('name', tenantName);
    params.append('email', tenantEmail);
    params.append('metadata[tenantId]', tenantId);

    const response = await fetch(`${this.baseUrl}/customers`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const json = (await response.json()) as Record<string, any>;

    if (!response.ok) {
      // If customer already exists (duplicate), try to find by email
      if (json.error?.code === 'resource_already_exists' || json.error?.type === 'APIError') {
        const existing = await this.findCustomerByEmail(tenantEmail);
        if (existing) return existing;
      }
      throw new BadRequestException(
        `Stripe customer create error: ${json.error?.message ?? response.statusText}`,
      );
    }

    return { id: json.id };
  }

  private async findCustomerByEmail(email: string): Promise<{ id: string } | null> {
    const response = await fetch(
      `${this.baseUrl}/customers?email=${encodeURIComponent(email)}&limit=1`,
      {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      },
    );

    const json = (await response.json()) as Record<string, any>;
    const customer = json.data?.[0];
    return customer ? { id: customer.id } : null;
  }
}
