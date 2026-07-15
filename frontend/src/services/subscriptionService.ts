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
};

export default subscriptionService;
