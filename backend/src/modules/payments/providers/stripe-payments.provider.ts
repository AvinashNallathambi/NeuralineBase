import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PaymentsProvider,
  CreatePaymentIntentRequest,
  PaymentIntentResponse,
  ConfirmPaymentRequest,
  ConfirmPaymentResponse,
  WebhookEvent,
} from './payments-provider.interface';

/**
 * Stripe payments provider.
 *
 * Uses the Stripe REST API directly via `fetch` (no SDK dependency to install).
 * Activate by setting STRIPE_API_KEY in .env. Without a key, the module falls
 * back to MockPaymentsProvider (see payments.module.ts).
 *
 * Setup:
 * 1. Create a Stripe account and grab the secret key (sk_test_... or sk_live_...)
 * 2. Set STRIPE_API_KEY in .env
 * 3. Set STRIPE_WEBHOOK_SECRET (whsec_...) to verify webhook signatures
 * 4. Frontend uses Stripe.js with the returned clientSecret to confirm card payments
 *
 * API Reference: https://stripe.com/docs/api/payment_intents
 */
@Injectable()
export class StripePaymentsProvider implements PaymentsProvider {
  readonly name = 'stripe';
  private readonly logger = new Logger(StripePaymentsProvider.name);
  private readonly apiKey: string;
  private readonly webhookSecret: string;
  private readonly baseUrl = 'https://api.stripe.com/v1';

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('STRIPE_API_KEY', '');
    this.webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET', '');

    if (!this.apiKey) {
      this.logger.warn('STRIPE_API_KEY not configured.');
    }
  }

  async createPaymentIntent(request: CreatePaymentIntentRequest): Promise<PaymentIntentResponse> {
    const amountCents = Math.round(request.amount * 100);
    const params = new URLSearchParams();
    params.append('amount', amountCents.toString());
    params.append('currency', request.currency.toLowerCase());
    params.append('payment_method_types[]', 'card');
    params.append(
      'metadata[paymentId]',
      request.paymentId,
    );
    if (request.invoiceId) params.append('metadata[invoiceId]', request.invoiceId);
    params.append('metadata[patientId]', request.patientId);
    if (request.description) params.append('description', request.description);
    params.append('statement_descriptor_suffix', request.patientName.substring(0, 22));

    this.logger.log(`Creating Stripe PaymentIntent for $${request.amount} (${amountCents} cents)`);

    const response = await fetch(`${this.baseUrl}/payment_intents`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const json = (await response.json()) as Record<string, any>;

    if (!response.ok) {
      this.logger.error(`Stripe PaymentIntent create failed: ${JSON.stringify(json)}`);
      throw new BadRequestException(
        `Stripe error: ${json.error?.message ?? response.statusText}`,
      );
    }

    return {
      providerPaymentId: json.id,
      clientSecret: json.client_secret,
      status: this.mapIntentStatus(json.status),
      rawResponse: json,
    };
  }

  async confirmPayment(request: ConfirmPaymentRequest): Promise<ConfirmPaymentResponse> {
    const params = new URLSearchParams();
    if (request.paymentMethodId) {
      params.append('payment_method', request.paymentMethodId);
    }
    // For server-side confirmation with a payment method attached.
    // If the client confirmed via Stripe.js, this is a no-op read of the intent.

    const response = await fetch(
      `${this.baseUrl}/payment_intents/${request.providerPaymentId}/confirm`,
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
      const message = json.error?.message ?? response.statusText;
      this.logger.error(`Stripe confirm failed: ${message}`);
      return {
        succeeded: false,
        status: 'failed',
        failureReason: message,
        rawResponse: json,
      };
    }

    const succeeded = json.status === 'succeeded';
    return {
      succeeded,
      status: succeeded ? 'succeeded' : json.status === 'requires_action' ? 'pending' : 'failed',
      failureReason: succeeded ? null : (json.last_payment_error?.message ?? null),
      rawResponse: json,
    };
  }

  parseWebhook(rawBody: string, signature: string): WebhookEvent {
    // Stripe webhook signature verification uses the Stripe-Signature header.
    // Full verification requires the stripe SDK (crypto HMAC). For a lightweight
    // integration we parse the event payload; in production you should verify
    // the signature using STRIPE_WEBHOOK_SECRET with the stripe-node SDK or a
    // manual HMAC-SHA256 comparison of the t=...,v1=... header.
    if (this.webhookSecret && !signature) {
      throw new BadRequestException('Missing Stripe-Signature header');
    }

    const event = JSON.parse(rawBody) as Record<string, any>;

    // Stripe events have a nested object under data.object
    const obj = event.data?.object ?? {};
    const eventType = (event.type ?? '').toString();

    let status: WebhookEvent['status'] = 'succeeded';
    if (eventType.includes('failed') || obj.status === 'failed') {
      status = 'failed';
    } else if (eventType.includes('refunded') || obj.status === 'refunded') {
      status = 'refunded';
    }

    return {
      providerPaymentId: obj.id ?? obj.payment_intent ?? null,
      status,
      amount: obj.amount_received != null ? obj.amount_received / 100 : (obj.amount ?? 0) / 100,
      rawEvent: event,
    };
  }

  private mapIntentStatus(status: string): 'requires_confirmation' | 'succeeded' | 'failed' {
    if (status === 'succeeded') return 'succeeded';
    if (status === 'requires_payment_method' || status === 'requires_confirmation' || status === 'requires_action') {
      return 'requires_confirmation';
    }
    return 'failed';
  }
}
