/**
 * Claim submission provider abstraction.
 *
 * Implementations translate an internal ClaimSubmissionRequest into the
 * transport required by the clearinghouse/payer (e.g. X12 837 or a JSON
 * claims API such as Stedi's) and return a tracking identifier that can be
 * polled for status.
 */

export interface ClaimLineItemSubmission {
  codeType: string; // 'CPT' | 'HCPCS' | 'ICD10' (for diagnosis) etc.
  code: string;
  description: string;
  modifiers?: string[];
  quantity: number;
  unitPrice: number;
  totalCharge: number;
  serviceDate?: Date | null;
  diagnosisPointer?: string[];
}

export interface ClaimSubmissionRequest {
  claimId: string;
  claimNumber: string;
  tenantId: string;

  // Patient
  patientId: string;
  patientName: string;
  patientDob?: string | null;

  // Provider (rendering)
  providerId: string;
  providerName: string;
  providerNpi: string;

  // Insurance
  insurancePayerId?: string | null;
  insurancePayerName?: string | null;
  tradingPartnerId?: string | null;
  policyNumber?: string | null;
  groupNumber?: string | null;
  subscriberName?: string | null;
  subscriberDob?: string | null;
  subscriberRelation?: string | null;

  // Service
  serviceDate: Date;

  // Lines
  lineItems: ClaimLineItemSubmission[];

  // Total
  totalBilled: number;
}

export type ClaimSubmissionStatus =
  | 'accepted'
  | 'rejected'
  | 'in_process'
  | 'paid'
  | 'denied'
  | 'unknown';

export interface ClaimSubmissionResponse {
  accepted: boolean;
  clearinghouseTrackingId: string;
  payerClaimId?: string | null;
  status: ClaimSubmissionStatus;
  errorCode?: string | null;
  errorMessage?: string | null;
  rawResponse?: Record<string, unknown> | null;
}

export interface ClaimStatusResponse {
  clearinghouseTrackingId: string;
  status: ClaimSubmissionStatus;
  payerClaimId?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  rawResponse?: Record<string, unknown> | null;
}

export interface ClaimsProvider {
  readonly name: string;
  submit(request: ClaimSubmissionRequest): Promise<ClaimSubmissionResponse>;
  getStatus(clearinghouseTrackingId: string): Promise<ClaimStatusResponse>;
}

export const CLAIMS_PROVIDER = Symbol('CLAIMS_PROVIDER');
