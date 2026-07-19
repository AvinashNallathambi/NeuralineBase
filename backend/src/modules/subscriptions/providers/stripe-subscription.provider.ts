import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import {
  SubscriptionProvider,
  CreateSubscriptionRequest,
  CreateSubscriptionResponse,
  CancelSubscriptionRequest,
  CancelSubscriptionResponse,
  ChangePlanRequest,
  ChangePlanResponse,
  SubscriptionWebhookEvent,
  PaymentMethodDetails,
  GetPaymentMethodRequest,
  CreateSetupIntentRequest,
  CreateSetupIntentResponse,
  AttachPaymentMethodRequest,
  AttachPaymentMethodResponse,
  DetachPaymentMethodRequest,
  DetachPaymentMethodResponse,
  SetDefaultPaymentMethodRequest,
  SetDefaultPaymentMethodResponse,
  CreateCustomerPortalSessionRequest,
  CreateCustomerPortalSessionResponse,
  RetryInvoiceRequest,
  RetryInvoiceResponse,
} from './subscription-provider.interface';

/**
 * Stripe subscription provider.
 *
 * Uses the Stripe REST API directly via `fetch` for most calls (keeps SDK out
 * of the request path) but imports the official `stripe` SDK for webhook
 * signature verification, which is the only safe way to validate webhooks.
 *
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
  private readonly stripeSdk: Stripe | null = null;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('STRIPE_API_KEY', '');
    this.webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET', '');
    if (this.apiKey) {
      this.stripeSdk = new Stripe(this.apiKey, { apiVersion: '2024-06-20' as any });
    }
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

    // Explicit proration behavior:
    // - Upgrades: create prorations (customer pays difference now)
    // - Downgrades: no prorations (difference credited to account balance)
    if (request.prorate === false) {
      params.append('proration_behavior', 'none');
    } else if (request.prorate === true) {
      params.append('proration_behavior', 'create_prorations');
    }
    // If prorate is undefined, let Stripe use its default (create_prorations)

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

  parseWebhook(rawBody: string | Buffer, signature: string): SubscriptionWebhookEvent {
    if (!this.webhookSecret) {
      throw new BadRequestException(
        'STRIPE_WEBHOOK_SECRET is not configured. Webhooks cannot be verified.',
      );
    }
    if (!signature) {
      throw new BadRequestException('Missing Stripe-Signature header');
    }
    if (!this.stripeSdk) {
      throw new BadRequestException('Stripe SDK not initialized — missing STRIPE_API_KEY');
    }

    // Verify webhook signature using the official Stripe SDK
    let event: Stripe.Event;
    try {
      event = this.stripeSdk.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
    } catch (err: any) {
      this.logger.error(`Webhook signature verification failed: ${err.message}`);
      throw new BadRequestException(`Invalid webhook signature: ${err.message}`);
    }

    const obj = event.data?.object as Record<string, any> ?? {};
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

    // Extract invoice data from subscription.latest_invoice or invoice object
    const invoiceObj = this.extractInvoice(event, obj);

    // For invoice events, the subscription ID is in obj.subscription, not obj.id
    let providerSubscriptionId = obj.id ?? '';
    if (event.type?.startsWith('invoice.')) {
      providerSubscriptionId = typeof obj.subscription === 'string'
        ? obj.subscription
        : (obj.subscription?.id ?? obj.id ?? '');
    }

    return {
      eventId: event.id,
      providerSubscriptionId,
      status,
      currentPeriodStart: obj.current_period_start
        ? new Date(obj.current_period_start * 1000)
        : undefined,
      currentPeriodEnd: obj.current_period_end
        ? new Date(obj.current_period_end * 1000)
        : undefined,
      trialEnd: obj.trial_end ? new Date(obj.trial_end * 1000) : null,
      invoice: invoiceObj,
      rawEvent: event as any,
    };
  }

  private extractInvoice(
    event: Stripe.Event,
    obj: Record<string, any>,
  ): SubscriptionWebhookEvent['invoice'] {
    let invoice: Record<string, any> | undefined;

    if (event.type?.startsWith('invoice.')) {
      invoice = obj;
    } else if (obj.latest_invoice) {
      if (typeof obj.latest_invoice === 'object') {
        invoice = obj.latest_invoice;
      }
    }

    if (!invoice) return null;

    const amount = (invoice.total ?? 0) / 100;
    const currency = invoice.currency ?? 'usd';

    let invoiceStatus: 'paid' | 'open' | 'failed' | 'uncollectible' | 'void' = 'open';
    switch (invoice.status) {
      case 'paid':
        invoiceStatus = 'paid';
        break;
      case 'open':
        invoiceStatus = 'open';
        break;
      case 'uncollectible':
        invoiceStatus = 'uncollectible';
        break;
      case 'void':
        invoiceStatus = 'void';
        break;
      default:
        invoiceStatus = 'open';
    }
    if (event.type === 'invoice.payment_failed') {
      invoiceStatus = 'failed';
    }

    const periodStart = invoice.period_start
      ? new Date(invoice.period_start * 1000)
      : undefined;
    const periodEnd = invoice.period_end
      ? new Date(invoice.period_end * 1000)
      : undefined;

    return {
      id: invoice.id,
      amount,
      currency,
      status: invoiceStatus,
      hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
      paidAt: invoice.status === 'paid' && invoice.created
        ? new Date(invoice.created * 1000)
        : null,
      failureReason: invoice.last_finalization_error?.message
        ? String(invoice.last_finalization_error.message)
        : null,
      paymentMethodId: invoice.default_payment_method
        ? (typeof invoice.default_payment_method === 'string'
            ? invoice.default_payment_method
            : invoice.default_payment_method.id)
        : null,
      periodStart,
      periodEnd,
    };
  }

  // ── Payment Method Management (Phase 1, 3) ────────────────────────

  async getPaymentMethods(request: GetPaymentMethodRequest): Promise<PaymentMethodDetails[]> {
    const response = await fetch(
      `${this.baseUrl}/payment_methods?customer=${request.stripeCustomerId}&type=card`,
      { headers: { Authorization: `Bearer ${this.apiKey}` } },
    );
    const json = (await response.json()) as Record<string, any>;
    if (!response.ok) {
      this.logger.error(`Stripe getPaymentMethods failed: ${JSON.stringify(json)}`);
      throw new BadRequestException(
        `Stripe error: ${json.error?.message ?? response.statusText}`,
      );
    }

    // Also get the customer's default payment method ID
    const customer = await this.getCustomer(request.stripeCustomerId);
    const defaultPmId = customer.invoice_settings?.default_payment_method ?? null;

    const methods: PaymentMethodDetails[] = [];
    for (const pm of json.data ?? []) {
      methods.push(this.mapPaymentMethod(pm, pm.id === defaultPmId));
    }

    // Also fetch US bank account payment methods
    const bankResp = await fetch(
      `${this.baseUrl}/payment_methods?customer=${request.stripeCustomerId}&type=us_bank_account`,
      { headers: { Authorization: `Bearer ${this.apiKey}` } },
    );
    const bankJson = (await bankResp.json()) as Record<string, any>;
    if (bankResp.ok) {
      for (const pm of bankJson.data ?? []) {
        methods.push(this.mapPaymentMethod(pm, pm.id === defaultPmId));
      }
    }

    return methods;
  }

  async createSetupIntent(request: CreateSetupIntentRequest): Promise<CreateSetupIntentResponse> {
    const params = new URLSearchParams();
    params.append('customer', request.stripeCustomerId);
    params.append('usage', 'off_session');

    const types = request.paymentMethodTypes ?? ['card'];
    for (const t of types) {
      params.append('payment_method_types[]', t);
    }

    if (request.metadata) {
      for (const [key, val] of Object.entries(request.metadata)) {
        params.append(`metadata[${key}]`, String(val));
      }
    }

    const response = await fetch(`${this.baseUrl}/setup_intents`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const json = (await response.json()) as Record<string, any>;
    if (!response.ok) {
      this.logger.error(`Stripe createSetupIntent failed: ${JSON.stringify(json)}`);
      throw new BadRequestException(
        `Stripe error: ${json.error?.message ?? response.statusText}`,
      );
    }

    return {
      clientSecret: json.client_secret,
      setupIntentId: json.id,
      rawResponse: json,
    };
  }

  async attachPaymentMethod(
    request: AttachPaymentMethodRequest,
  ): Promise<AttachPaymentMethodResponse> {
    // 1. Attach the payment method to the customer
    const attachParams = new URLSearchParams();
    attachParams.append('customer', request.stripeCustomerId);

    const attachResp = await fetch(
      `${this.baseUrl}/payment_methods/${request.stripePaymentMethodId}/attach`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: attachParams.toString(),
      },
    );

    const pmJson = (await attachResp.json()) as Record<string, any>;
    if (!attachResp.ok) {
      this.logger.error(`Stripe attach failed: ${JSON.stringify(pmJson)}`);
      throw new BadRequestException(
        `Stripe error: ${pmJson.error?.message ?? attachResp.statusText}`,
      );
    }

    // 2. Set as default if requested
    if (request.setAsDefault) {
      await this.setDefaultPaymentMethod({
        stripeCustomerId: request.stripeCustomerId,
        stripePaymentMethodId: request.stripePaymentMethodId,
        stripeSubscriptionId: request.stripeSubscriptionId,
      });
    }

    const paymentMethod = this.mapPaymentMethod(pmJson, request.setAsDefault ?? false);

    return {
      success: true,
      paymentMethod,
      rawResponse: pmJson,
    };
  }

  async detachPaymentMethod(
    request: DetachPaymentMethodRequest,
  ): Promise<DetachPaymentMethodResponse> {
    const response = await fetch(
      `${this.baseUrl}/payment_methods/${request.stripePaymentMethodId}/detach`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    );

    const json = (await response.json()) as Record<string, any>;
    if (!response.ok) {
      this.logger.error(`Stripe detach failed: ${JSON.stringify(json)}`);
      throw new BadRequestException(
        `Stripe error: ${json.error?.message ?? response.statusText}`,
      );
    }

    return { success: true, rawResponse: json };
  }

  async setDefaultPaymentMethod(
    request: SetDefaultPaymentMethodRequest,
  ): Promise<SetDefaultPaymentMethodResponse> {
    // 1. Update customer's invoice_settings.default_payment_method
    const custParams = new URLSearchParams();
    custParams.append('invoice_settings[default_payment_method]', request.stripePaymentMethodId);

    const custResp = await fetch(`${this.baseUrl}/customers/${request.stripeCustomerId}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: custParams.toString(),
    });

    const custJson = (await custResp.json()) as Record<string, any>;
    if (!custResp.ok) {
      this.logger.error(`Stripe setDefault (customer) failed: ${JSON.stringify(custJson)}`);
      throw new BadRequestException(
        `Stripe error: ${custJson.error?.message ?? custResp.statusText}`,
      );
    }

    // 2. Update subscription's default payment method if provided
    if (request.stripeSubscriptionId) {
      const subParams = new URLSearchParams();
      subParams.append('default_payment_method', request.stripePaymentMethodId);

      const subResp = await fetch(
        `${this.baseUrl}/subscriptions/${request.stripeSubscriptionId}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: subParams.toString(),
        },
      );

      const subJson = (await subResp.json()) as Record<string, any>;
      if (!subResp.ok) {
        this.logger.error(`Stripe setDefault (subscription) failed: ${JSON.stringify(subJson)}`);
        // Don't throw — customer default was set successfully
      }
    }

    return { success: true, rawResponse: custJson };
  }

  // ── Customer Portal (Phase 4) ─────────────────────────────────────

  async createCustomerPortalSession(
    request: CreateCustomerPortalSessionRequest,
  ): Promise<CreateCustomerPortalSessionResponse> {
    const params = new URLSearchParams();
    params.append('customer', request.stripeCustomerId);
    params.append('return_url', request.returnUrl);

    const response = await fetch(`${this.baseUrl}/billing_portal/sessions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const json = (await response.json()) as Record<string, any>;
    if (!response.ok) {
      this.logger.error(`Stripe portal session failed: ${JSON.stringify(json)}`);
      throw new BadRequestException(
        `Stripe error: ${json.error?.message ?? response.statusText}`,
      );
    }

    return { url: json.url, rawResponse: json };
  }

  // ── Retry Invoice / Dunning (Phase 2) ─────────────────────────────

  async retryInvoice(request: RetryInvoiceRequest): Promise<RetryInvoiceResponse> {
    // Pay the invoice with the specified payment method
    const params = new URLSearchParams();
    params.append('payment_method', request.stripePaymentMethodId);
    params.append('paid_out_of_band', 'true');

    const response = await fetch(`${this.baseUrl}/invoices/${request.stripeInvoiceId}/pay`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const json = (await response.json()) as Record<string, any>;
    if (!response.ok) {
      this.logger.error(`Stripe retry invoice failed: ${JSON.stringify(json)}`);
      return { success: false, status: json.error?.message ?? 'failed', rawResponse: json };
    }

    return { success: true, status: json.status ?? 'paid', rawResponse: json };
  }

  // ── Private helpers ───────────────────────────────────────────────

  private async getCustomer(customerId: string): Promise<Record<string, any>> {
    const response = await fetch(`${this.baseUrl}/customers/${customerId}`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    const json = (await response.json()) as Record<string, any>;
    if (!response.ok) {
      throw new BadRequestException(
        `Stripe get customer error: ${json.error?.message ?? response.statusText}`,
      );
    }
    return json;
  }

  private mapPaymentMethod(pm: Record<string, any>, isDefault: boolean): PaymentMethodDetails {
    const type = pm.type ?? 'card';
    const card = pm.card;
    const bank = pm.us_bank_account;

    // Detect HSA/FSA: Stripe doesn't have a direct flag, but funding=prepaid
    // + healthcare category metadata can indicate HSA/FSA
    const isHsaFsa = card?.funding === 'prepaid' && pm.metadata?.hsa_fsa === 'true';

    return {
      stripePaymentMethodId: pm.id,
      type,
      cardBrand: card?.brand ?? null,
      cardLast4: card?.last4 ?? null,
      cardExpMonth: card?.exp_month ?? null,
      cardExpYear: card?.exp_year ?? null,
      cardFunding: card?.funding ?? null,
      bankName: bank?.bank_name ?? null,
      bankLast4: bank?.last4 ?? null,
      bankAccountType: bank?.account_type ?? null,
      billingName: pm.billing_details?.name ?? null,
      billingAddress: pm.billing_details?.address ?? null,
      isDefault,
      isHsaFsa,
      metadata: pm.metadata ?? {},
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
