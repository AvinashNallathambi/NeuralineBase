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

export interface SubscriptionProvider {
  readonly name: string;
  createSubscription(request: CreateSubscriptionRequest): Promise<CreateSubscriptionResponse>;
  cancelSubscription(request: CancelSubscriptionRequest): Promise<CancelSubscriptionResponse>;
  changePlan(request: ChangePlanRequest): Promise<ChangePlanResponse>;
  parseWebhook(rawBody: string, signature: string): SubscriptionWebhookEvent;
}

export const SUBSCRIPTION_PROVIDER = Symbol('SUBSCRIPTION_PROVIDER');
