import api from './api';

export interface SubscriptionPlan {
  id: string;
  tier: string;
  name: string;
  description: string;
  priceMonthlyCents: number;
  priceAnnualCents: number;
  maxProviders: number | null;
  maxPatients: number | null;
  maxLocations: number | null;
  includesRcm: boolean;
  includesAiScribe: boolean;
  includesAiCoding: boolean;
  includesPatientPortal: boolean;
  includesAutomation: boolean;
  aiCreditsMonthly: number;
  isActive: boolean;
}

export interface Subscription {
  id: string;
  tenantId: string;
  planTier: string;
  status: 'trialing' | 'active' | 'past_due' | 'cancelled' | 'expired' | 'paused';
  billingCycle: 'monthly' | 'annual';
  priceCents: number;
  currency: string;
  trialEndsAt: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelledAt: string | null;
  cancelAtPeriodEnd: boolean;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  provider: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionWithPlan {
  subscription: Subscription;
  plan: SubscriptionPlan;
}

export interface SubscriptionInvoice {
  id: string;
  tenantId: string;
  subscriptionId: string;
  invoiceNumber: string;
  planTier: string;
  billingCycle: string;
  amount: number;
  currency: string;
  status: 'paid' | 'open' | 'failed' | 'void' | 'refunded';
  periodStart: string;
  periodEnd: string;
  paidAt: string | null;
  failureReason: string | null;
  stripeHostedInvoiceUrl: string | null;
  createdAt: string;
}

export interface PaymentMethod {
  id: string;
  tenantId: string;
  stripePaymentMethodId: string;
  type: 'card' | 'us_bank_account' | 'sepa_debit' | 'bacs_debit' | 'acss_debit';
  cardBrand: string | null;
  cardLast4: string | null;
  cardExpMonth: number | null;
  cardExpYear: number | null;
  cardFunding: string | null;
  bankName: string | null;
  bankLast4: string | null;
  bankAccountType: string | null;
  billingName: string | null;
  billingAddress: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  } | null;
  isDefault: boolean;
  isHsaFsa: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface SetupIntentResponse {
  clientSecret: string;
  setupIntentId: string;
}

export interface CardExpiryCheck {
  expiringSoon: PaymentMethod[];
  expired: PaymentMethod[];
}

export interface FeeBreakdownItem {
  method: string;
  rate: string;
  fixedFee: string;
  estimatedFee: number;
  estimatedNet: number;
}

export interface FeeEstimate {
  cardFee: number;
  achFee: number;
  currentMethodFee: number;
  potentialSavings: number;
  feeBreakdown: FeeBreakdownItem[];
}

export interface PaymentOptimizationSuggestion {
  type: 'switch_to_ach' | 'add_backup_card' | 'update_expired_card' | 'annual_billing' | 'remove_unused_method';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  potentialSavings?: number;
  actionUrl: string;
  actionLabel: string;
}

export interface PaymentOptimizationResponse {
  suggestions: PaymentOptimizationSuggestion[];
}

export interface PaymentPlan {
  id: string;
  tenantId: string;
  subscriptionId: string | null;
  description: string;
  totalAmount: number;
  paidAmount: number;
  installmentAmount: number;
  frequency: 'weekly' | 'biweekly' | 'monthly';
  totalInstallments: number;
  paidInstallments: number;
  status: 'active' | 'completed' | 'cancelled' | 'past_due';
  nextPaymentDate: string | null;
  startDate: string;
  endDate: string | null;
  stripePaymentMethodId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

const BASE = '/subscriptions';

export const subscriptionService = {
  /** List all available plans */
  getPlans: (): Promise<SubscriptionPlan[]> => api.get(`${BASE}/plans`).then((r) => r.data),

  /** Get current subscription with plan details */
  getCurrent: (): Promise<SubscriptionWithPlan> =>
    api.get(`${BASE}/current`).then((r) => r.data),

  /** Create a new subscription (post-registration) */
  create: (data: {
    planTier: string;
    billingCycle?: 'monthly' | 'annual';
    tenantName?: string;
    tenantEmail?: string;
  }): Promise<Subscription> => api.post(`${BASE}/create`, data).then((r) => r.data),

  /** Change plan (upgrade/downgrade) */
  changePlan: (data: {
    planTier: string;
    billingCycle?: 'monthly' | 'annual';
  }): Promise<Subscription> => api.patch(`${BASE}/change-plan`, data).then((r) => r.data),

  /** Cancel subscription */
  cancel: (cancelAtPeriodEnd: boolean): Promise<Subscription> =>
    api.post(`${BASE}/cancel`, { cancelAtPeriodEnd }).then((r) => r.data),

  /** Reactivate a cancelled subscription */
  reactivate: (): Promise<Subscription> =>
    api.post(`${BASE}/reactivate`).then((r) => r.data),

  /** Get billing history (invoices) */
  getInvoices: (): Promise<SubscriptionInvoice[]> =>
    api.get(`${BASE}/invoices`).then((r) => r.data),

  /** Check if current plan includes a feature */
  checkFeature: (feature: string): Promise<{ feature: string; hasFeature: boolean }> =>
    api.get(`${BASE}/features/${feature}`).then((r) => r.data),

  // ── Payment Method Management (Phase 1, 3) ────────────────────────

  /** Get all saved payment methods */
  getPaymentMethods: (): Promise<PaymentMethod[]> =>
    api.get(`${BASE}/payment-methods`).then((r) => r.data),

  /** Create a SetupIntent for collecting new payment method details */
  createSetupIntent: (paymentMethodTypes?: string[]): Promise<SetupIntentResponse> =>
    api.post(`${BASE}/setup-intent`, { paymentMethodTypes }).then((r) => r.data),

  /** Attach a new payment method (after Stripe Elements confirms SetupIntent) */
  attachPaymentMethod: (
    stripePaymentMethodId: string,
    setAsDefault?: boolean,
  ): Promise<PaymentMethod> =>
    api
      .post(`${BASE}/payment-methods/attach`, { stripePaymentMethodId, setAsDefault })
      .then((r) => r.data),

  /** Detach (remove) a payment method */
  detachPaymentMethod: (id: string): Promise<{ success: boolean }> =>
    api.delete(`${BASE}/payment-methods/${id}`).then((r) => r.data),

  /** Set a payment method as the default */
  setDefaultPaymentMethod: (id: string): Promise<PaymentMethod> =>
    api.patch(`${BASE}/payment-methods/${id}/default`).then((r) => r.data),

  // ── Card Expiry Check (Phase 2) ───────────────────────────────────

  /** Check for expiring or expired cards */
  checkCardExpiry: (): Promise<CardExpiryCheck> =>
    api.get(`${BASE}/payment-methods/expiry-check`).then((r) => r.data),

  // ── Retry Failed Payment (Phase 2) ────────────────────────────────

  /** Retry a failed invoice payment */
  retryFailedPayment: (): Promise<{ success: boolean; status: string }> =>
    api.post(`${BASE}/retry-payment`).then((r) => r.data),

  // ── Customer Portal (Phase 4) ─────────────────────────────────────

  /** Create a Stripe Customer Portal session */
  createCustomerPortalSession: (returnUrl?: string): Promise<{ url: string }> =>
    api.post(`${BASE}/customer-portal`, { returnUrl }).then((r) => r.data),

  // ── Transaction Fee Transparency (Phase 4) ────────────────────────

  /** Get processing fee estimates for different payment methods */
  getFeeEstimate: (): Promise<FeeEstimate> =>
    api.get(`${BASE}/fee-estimate`).then((r) => r.data),

  // ── AI-Driven Payment Optimization (Phase 4) ──────────────────────

  /** Get AI-driven payment optimization suggestions */
  getPaymentOptimization: (): Promise<PaymentOptimizationResponse> =>
    api.get(`${BASE}/payment-optimization`).then((r) => r.data),

  // ── Payment Plans / Scheduled Payments (Phase 4) ──────────────────

  /** Get all payment plans */
  getPaymentPlans: (): Promise<PaymentPlan[]> =>
    api.get(`${BASE}/payment-plans`).then((r) => r.data),

  /** Create a new payment plan */
  createPaymentPlan: (data: {
    description: string;
    totalAmount: number;
    installmentAmount: number;
    frequency?: string;
    stripePaymentMethodId?: string;
  }): Promise<PaymentPlan> =>
    api.post(`${BASE}/payment-plans`, data).then((r) => r.data),

  /** Record a payment against a payment plan installment */
  recordPaymentPlanInstallment: (
    planId: string,
    amount: number,
  ): Promise<PaymentPlan> =>
    api.post(`${BASE}/payment-plans/${planId}/installment`, { amount }).then((r) => r.data),

  /** Cancel a payment plan */
  cancelPaymentPlan: (planId: string): Promise<PaymentPlan> =>
    api.post(`${BASE}/payment-plans/${planId}/cancel`).then((r) => r.data),
};

export default subscriptionService;
