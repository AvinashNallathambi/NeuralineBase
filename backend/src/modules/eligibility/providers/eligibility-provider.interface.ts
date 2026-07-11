export interface EligibilityRequest {
  patientId: string;
  patientInsuranceId?: string | null;
  insurancePayerId?: string | null;
  policyNumber?: string | null;
  groupNumber?: string | null;
  subscriberName?: string | null;
  subscriberDob?: string | null;
  subscriberRelation?: string | null;
  serviceType?: string | null;
  appointmentId?: string | null;
}

export interface EligibilityResponse {
  eligible: boolean;
  coverageStatus: 'active' | 'inactive' | 'terminated' | 'unknown';
  effectiveDate?: string | null;
  expirationDate?: string | null;
  planName?: string | null;
  planType?: string | null;
  network?: string | null;
  subscriberName?: string | null;
  subscriberRelation?: string | null;
  payerName?: string | null;
  deductibleIndividual?: number | null;
  deductibleFamily?: number | null;
  deductibleRemaining?: number | null;
  outOfPocketIndividual?: number | null;
  outOfPocketFamily?: number | null;
  outOfPocketRemaining?: number | null;
  copayAmount?: number | null;
  coinsurancePercentage?: number | null;
  authorizationRequired?: boolean;
  referralRequired?: boolean;
  benefitLimitations?: Record<string, unknown> | null;
  benefits?: Record<string, unknown>[] | null;
  rawResponse?: Record<string, unknown> | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}

export interface EligibilityProvider {
  readonly name: string;
  verify(request: EligibilityRequest): Promise<EligibilityResponse>;
}

export const ELIGIBILITY_PROVIDER = Symbol('ELIGIBILITY_PROVIDER');
