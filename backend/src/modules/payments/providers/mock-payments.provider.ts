import { Injectable, Logger } from '@nestjs/common';
import {
  PaymentsProvider,
  CreatePaymentIntentRequest,
  PaymentIntentResponse,
  ConfirmPaymentRequest,
  ConfirmPaymentResponse,
  WebhookEvent,
} from './payments-provider.interface';

/**
 * Mock payments provider for development without Stripe.
 *
 * Simulates a PaymentIntent lifecycle: create → confirm → succeeded.
 * No network calls. Useful for end-to-end testing of the patient portal
 * payment flow without real card data.
 */
@Injectable()
export class MockPaymentsProvider implements PaymentsProvider {
  readonly name = 'mock';
  private readonly logger = new Logger(MockPaymentsProvider.name);

  async createPaymentIntent(request: CreatePaymentIntentRequest): Promise<PaymentIntentResponse> {
    this.logger.log(`Mock intent for payment ${request.paymentId}: $${request.amount}`);
    const providerPaymentId = `mock_pi_${request.paymentId}_${Date.now().toString(36)}`;
    return {
      providerPaymentId,
      clientSecret: `${providerPaymentId}_secret_mock`,
      status: 'requires_confirmation',
      rawResponse: { mock: true, amount: request.amount },
    };
  }

  async confirmPayment(request: ConfirmPaymentRequest): Promise<ConfirmPaymentResponse> {
    this.logger.log(`Mock confirm for ${request.providerPaymentId}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
    return {
      succeeded: true,
      status: 'succeeded',
      rawResponse: { mock: true, providerPaymentId: request.providerPaymentId },
    };
  }

  parseWebhook(rawBody: string, signature: string): WebhookEvent {
    this.logger.log(`Mock webhook received (sig=${signature || 'none'})`);
    const parsed = JSON.parse(rawBody || '{}');
    return {
      providerPaymentId: parsed.providerPaymentId ?? 'mock_pi_unknown',
      status: parsed.status ?? 'succeeded',
      amount: parsed.amount ?? 0,
      rawEvent: parsed,
    };
  }
}
