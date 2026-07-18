export interface CreateSubscriptionRequest {
  subscriptionId: string; // internal Subscription record id
  tenantId: string;
  tenantName: string;
  tenantEmail: string;
  planTier: string;
  billingCycle: 'monthly' | 'annual';
  priceCents: number;
  stripePriceId?: string | null;
  trialDays?: number;
  metadata?: Record<string, unknown>;
}

export interface CreateSubscriptionResponse {
  providerSubscriptionId: string;
  providerCustomerId: string;
  status: 'trialing' | 'active' | 'past_due' | 'canceled';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialEnd?: Date | null;
  hostedInvoiceUrl?: string | null;
  rawResponse?: Record<string, unknown> | null;
}

export interface CancelSubscriptionRequest {
  providerSubscriptionId: string;
  cancelAtPeriodEnd?: boolean;
}

export interface CancelSubscriptionResponse {
  status: 'canceled' | 'active';
  cancelAtPeriodEnd: boolean;
  canceledAt?: Date | null;
  rawResponse?: Record<string, unknown> | null;
}

export interface ChangePlanRequest {
  providerSubscriptionId: string;
  newStripePriceId: string;
  prorate?: boolean;
}

export interface ChangePlanResponse {
  providerSubscriptionId: string;
  status: 'active' | 'trialing';
  rawResponse?: Record<string, unknown> | null;
}

export interface SubscriptionWebhookEvent {
  providerSubscriptionId: string;
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired';
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  trialEnd?: Date | null;
  rawEvent: Record<string, unknown>;
}

// ── Payment Method Interfaces (Phase 1, 3) ──────────────────────────

export interface PaymentMethodDetails {
  stripePaymentMethodId: string;
  type: 'card' | 'us_bank_account' | 'sepa_debit' | 'bacs_debit' | 'acss_debit';
  // Card fields
  cardBrand?: string | null;
  cardLast4?: string | null;
  cardExpMonth?: number | null;
  cardExpYear?: number | null;
  cardFunding?: string | null;
  // Bank fields
  bankName?: string | null;
  bankLast4?: string | null;
  bankAccountType?: string | null;
  // Billing
  billingName?: string | null;
  billingAddress?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  } | null;
  isDefault?: boolean;
  isHsaFsa?: boolean;
  metadata?: Record<string, unknown>;
}

export interface GetPaymentMethodRequest {
  stripeCustomerId: string;
}

export interface CreateSetupIntentRequest {
  stripeCustomerId: string;
  paymentMethodTypes?: string[]; // ['card', 'us_bank_account']
  metadata?: Record<string, unknown>;
}

export interface CreateSetupIntentResponse {
  clientSecret: string;
  setupIntentId: string;
  rawResponse?: Record<string, unknown> | null;
}

export interface AttachPaymentMethodRequest {
  stripeCustomerId: string;
  stripePaymentMethodId: string;
  setAsDefault?: boolean;
  // For subscriptions: also update the subscription's default payment method
  stripeSubscriptionId?: string | null;
}

export interface AttachPaymentMethodResponse {
  success: boolean;
  paymentMethod: PaymentMethodDetails;
  rawResponse?: Record<string, unknown> | null;
}

export interface DetachPaymentMethodRequest {
  stripePaymentMethodId: string;
}

export interface DetachPaymentMethodResponse {
  success: boolean;
  rawResponse?: Record<string, unknown> | null;
}

export interface SetDefaultPaymentMethodRequest {
  stripeCustomerId: string;
  stripePaymentMethodId: string;
  stripeSubscriptionId?: string | null;
}

export interface SetDefaultPaymentMethodResponse {
  success: boolean;
  rawResponse?: Record<string, unknown> | null;
}

// ── Customer Portal (Phase 4) ───────────────────────────────────────

export interface CreateCustomerPortalSessionRequest {
  stripeCustomerId: string;
  returnUrl: string;
}

export interface CreateCustomerPortalSessionResponse {
  url: string;
  rawResponse?: Record<string, unknown> | null;
}

// ── Retry Payment / Dunning (Phase 2) ───────────────────────────────

export interface RetryInvoiceRequest {
  stripeInvoiceId: string;
  stripePaymentMethodId: string;
}

export interface RetryInvoiceResponse {
  success: boolean;
  status: string; // paid | open | uncollectible
  rawResponse?: Record<string, unknown> | null;
}

export interface SubscriptionProvider {
  readonly name: string;

  // ── Subscription lifecycle ────────────────────────────────────────
  createSubscription(request: CreateSubscriptionRequest): Promise<CreateSubscriptionResponse>;
  cancelSubscription(request: CancelSubscriptionRequest): Promise<CancelSubscriptionResponse>;
  changePlan(request: ChangePlanRequest): Promise<ChangePlanResponse>;
  parseWebhook(rawBody: string, signature: string): SubscriptionWebhookEvent;

  // ── Payment method management (Phase 1, 3) ───────────────────────
  getPaymentMethods(request: GetPaymentMethodRequest): Promise<PaymentMethodDetails[]>;
  createSetupIntent(request: CreateSetupIntentRequest): Promise<CreateSetupIntentResponse>;
  attachPaymentMethod(request: AttachPaymentMethodRequest): Promise<AttachPaymentMethodResponse>;
  detachPaymentMethod(request: DetachPaymentMethodRequest): Promise<DetachPaymentMethodResponse>;
  setDefaultPaymentMethod(
    request: SetDefaultPaymentMethodRequest,
  ): Promise<SetDefaultPaymentMethodResponse>;

  // ── Customer Portal (Phase 4) ────────────────────────────────────
  createCustomerPortalSession(
    request: CreateCustomerPortalSessionRequest,
  ): Promise<CreateCustomerPortalSessionResponse>;

  // ── Retry / Dunning (Phase 2) ────────────────────────────────────
  retryInvoice(request: RetryInvoiceRequest): Promise<RetryInvoiceResponse>;
}

export const SUBSCRIPTION_PROVIDER = Symbol('SUBSCRIPTION_PROVIDER');
