export interface CreatePaymentIntentRequest {
  paymentId: string; // internal Payment record id
  amount: number; // in major currency units (e.g. dollars), converted to cents by provider
  currency: string; // ISO 4217 (usd)
  description?: string;
  patientId: string;
  patientName: string;
  invoiceId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface PaymentIntentResponse {
  providerPaymentId: string;
  clientSecret: string | null;
  status: 'requires_confirmation' | 'succeeded' | 'failed';
  rawResponse?: Record<string, unknown> | null;
}

export interface ConfirmPaymentRequest {
  providerPaymentId: string;
  paymentMethodId?: string; // for stripe: pm_xxx; for mock: ignored
}

export interface ConfirmPaymentResponse {
  succeeded: boolean;
  status: 'succeeded' | 'failed' | 'pending';
  failureReason?: string | null;
  rawResponse?: Record<string, unknown> | null;
}

export interface WebhookEvent {
  providerPaymentId: string;
  status: 'succeeded' | 'failed' | 'refunded';
  amount: number;
  rawEvent: Record<string, unknown>;
}

export interface PaymentsProvider {
  readonly name: string;
  createPaymentIntent(request: CreatePaymentIntentRequest): Promise<PaymentIntentResponse>;
  confirmPayment(request: ConfirmPaymentRequest): Promise<ConfirmPaymentResponse>;
  parseWebhook(rawBody: string, signature: string): WebhookEvent;
}

export const PAYMENTS_PROVIDER = Symbol('PAYMENTS_PROVIDER');
