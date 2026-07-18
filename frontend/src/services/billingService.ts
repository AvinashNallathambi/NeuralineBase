import { api } from './api';

export interface ClaimLineItem {
  id?: string;
  codeType: string;
  code: string;
  description: string;
  modifiers?: string[];
  quantity: number;
  unitPrice: number;
  totalCharge?: number;
  serviceDate?: string;
  diagnosisPointer?: string[];
}

export interface EncounterClaim {
  id: string;
  tenantId: string;
  claimNumber: string;
  patientId: string;
  patientName: string;
  encounterId?: string;
  providerId: string;
  providerName: string;
  providerNPI: string;
  insurancePayerId?: string;
  insurancePayerName?: string;
  policyNumber?: string;
  groupNumber?: string;
  serviceDate: string;
  submissionDate?: string;
  status: 'draft' | 'ready_to_bill' | 'submitted' | 'paid' | 'denied' | 'partially_paid' | 'appealed' | 'cancelled';
  totalBilled: number;
  totalAllowed?: number;
  totalPaid: number;
  patientResponsibility: number;
  deductibleApplied: number;
  copayApplied: number;
  coinsuranceApplied: number;
  adjustmentAmount: number;
  denialReason?: string;
  notes?: string;
  lineItems: ClaimLineItem[];
  createdAt: string;
  updatedAt: string;
}

export interface Invoice {
  id: string;
  tenantId: string;
  invoiceNumber: string;
  patientId: string;
  patientName: string;
  encounterId?: string;
  claimId?: string;
  invoiceType: 'cash_pay' | 'self_pay' | 'balance_due';
  providerId: string;
  providerName: string;
  serviceDate: string;
  invoiceDate: string;
  dueDate: string;
  status: 'draft' | 'sent' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled';
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  paymentMethod?: string;
  paymentReference?: string;
  notes?: string;
  lineItems: ClaimLineItem[];
  createdAt: string;
  updatedAt: string;
}

export interface InsurancePayer {
  id: string;
  tenantId: string;
  payerId: string;
  name: string;
  payerType: string;
  address?: {
    street1: string;
    street2?: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  phone?: string;
  email?: string;
  website?: string;
  status: string;
}

export interface PatientInsurance {
  id: string;
  tenantId: string;
  patientId: string;
  insurancePayerId: string;
  priority: 'primary' | 'secondary' | 'tertiary';
  policyNumber: string;
  groupNumber?: string;
  subscriberName: string;
  subscriberRelation: 'self' | 'spouse' | 'child' | 'other';
  subscriberDob?: string;
  subscriberSsn?: string;
  authorizationNumber?: string;
  effectiveDate?: string;
  expirationDate?: string;
  copayAmount?: number;
  deductibleAmount?: number;
  coinsurancePercentage?: number;
  status: string;
  metadata?: Record<string, unknown>;
  cardFrontImage?: string | null;
  cardBackImage?: string | null;
  payer: InsurancePayer;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePatientInsuranceDto {
  patientId: string;
  insurancePayerId: string;
  priority?: 'primary' | 'secondary' | 'tertiary';
  policyNumber: string;
  groupNumber?: string;
  subscriberName: string;
  subscriberRelation?: 'self' | 'spouse' | 'child' | 'other';
  subscriberDob?: string;
  subscriberSsn?: string;
  authorizationNumber?: string;
  effectiveDate?: string;
  expirationDate?: string;
  copayAmount?: number;
  deductibleAmount?: number;
  coinsurancePercentage?: number;
  status?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdatePatientInsuranceDto extends Partial<CreatePatientInsuranceDto> {}

class BillingService {
  private baseUrl = '/billing';

  // ─── Claims ─────────────────────────────────────────────────────

  async findAllClaims(params?: {
    patientId?: string;
    providerId?: string;
    status?: string;
  }): Promise<EncounterClaim[]> {
    const query = new URLSearchParams();
    if (params?.patientId) query.append('patientId', params.patientId);
    if (params?.providerId) query.append('providerId', params.providerId);
    if (params?.status) query.append('status', params.status);

    const response = await api.get(`${this.baseUrl}/claims?${query.toString()}`);
    return response.data;
  }

  async findOneClaim(id: string): Promise<EncounterClaim> {
    const response = await api.get(`${this.baseUrl}/claims/${id}`);
    return response.data;
  }

  async createClaim(data: Partial<EncounterClaim>): Promise<EncounterClaim> {
    const response = await api.post(`${this.baseUrl}/claims`, data);
    return response.data;
  }

  async updateClaim(id: string, data: Partial<EncounterClaim>): Promise<EncounterClaim> {
    const response = await api.patch(`${this.baseUrl}/claims/${id}`, data);
    return response.data;
  }

  async deleteClaim(id: string): Promise<void> {
    await api.delete(`${this.baseUrl}/claims/${id}`);
  }

  async updateClaimStatus(id: string, status: string): Promise<EncounterClaim> {
    const response = await api.patch(`${this.baseUrl}/claims/${id}/status`, { status });
    return response.data;
  }

  async calculateClaimTotals(id: string): Promise<{
    totalBilled: number;
    totalAllowed: number;
    totalPaid: number;
    patientResponsibility: number;
    deductibleApplied: number;
    copayApplied: number;
    coinsuranceApplied: number;
    adjustmentAmount: number;
  }> {
    const response = await api.post(`${this.baseUrl}/claims/${id}/calculate`, {});
    return response.data;
  }

  // ─── Invoices ───────────────────────────────────────────────────

  async findAllInvoices(params?: {
    patientId?: string;
    providerId?: string;
    status?: string;
  }): Promise<Invoice[]> {
    const query = new URLSearchParams();
    if (params?.patientId) query.append('patientId', params.patientId);
    if (params?.providerId) query.append('providerId', params.providerId);
    if (params?.status) query.append('status', params.status);

    const response = await api.get(`${this.baseUrl}/invoices?${query.toString()}`);
    return response.data;
  }

  async findOneInvoice(id: string): Promise<Invoice> {
    const response = await api.get(`${this.baseUrl}/invoices/${id}`);
    return response.data;
  }

  async createInvoice(data: Partial<Invoice>): Promise<Invoice> {
    const response = await api.post(`${this.baseUrl}/invoices`, data);
    return response.data;
  }

  async updateInvoice(id: string, data: Partial<Invoice>): Promise<Invoice> {
    const response = await api.patch(`${this.baseUrl}/invoices/${id}`, data);
    return response.data;
  }

  async deleteInvoice(id: string): Promise<void> {
    await api.delete(`${this.baseUrl}/invoices/${id}`);
  }

  async updateInvoiceStatus(id: string, status: string): Promise<Invoice> {
    const response = await api.patch(`${this.baseUrl}/invoices/${id}/status`, { status });
    return response.data;
  }

  async recordPayment(id: string, amount: number, paymentMethod: string, reference?: string): Promise<Invoice> {
    const response = await api.post(`${this.baseUrl}/invoices/${id}/payment`, {
      amount,
      paymentMethod,
      reference,
    });
    return response.data;
  }

  // ─── Insurance Payers ───────────────────────────────────────────

  async findAllPayers(): Promise<InsurancePayer[]> {
    const response = await api.get(`${this.baseUrl}/payers`);
    return response.data;
  }

  async findOnePayer(id: string): Promise<InsurancePayer> {
    const response = await api.get(`${this.baseUrl}/payers/${id}`);
    return response.data;
  }

  // ─── Patient Insurance ─────────────────────────────────────────

  async findPatientInsurances(patientId: string): Promise<PatientInsurance[]> {
    const response = await api.get(`${this.baseUrl}/patients/${patientId}/insurance`);
    return response.data;
  }

  async createPatientInsurance(
    patientId: string,
    dto: CreatePatientInsuranceDto,
  ): Promise<PatientInsurance> {
    const response = await api.post(`${this.baseUrl}/patients/${patientId}/insurance`, dto);
    return response.data;
  }

  async updatePatientInsurance(
    patientId: string,
    id: string,
    dto: UpdatePatientInsuranceDto,
  ): Promise<PatientInsurance> {
    const response = await api.patch(`${this.baseUrl}/patients/${patientId}/insurance/${id}`, dto);
    return response.data;
  }

  async deletePatientInsurance(patientId: string, id: string): Promise<void> {
    await api.delete(`${this.baseUrl}/patients/${patientId}/insurance/${id}`);
  }

  async updateInsurancePriority(
    patientId: string,
    id: string,
    priority: 'primary' | 'secondary' | 'tertiary',
  ): Promise<PatientInsurance> {
    const response = await api.patch(
      `${this.baseUrl}/patients/${patientId}/insurance/${id}/priority`,
      { priority },
    );
    return response.data;
  }

  // ─── Insurance Card Scan (AI OCR) ──────────────────────────────

  async scanInsuranceCard(
    patientId: string,
    frontImage: File,
    backImage?: File,
  ): Promise<{
    extractedData: Partial<CreatePatientInsuranceDto>;
    confidence: Record<string, number>;
    matchedPayerId?: string;
    matchedPayerName?: string;
    warnings: string[];
  }> {
    const formData = new FormData();
    formData.append('frontImage', frontImage);
    if (backImage) formData.append('backImage', backImage);
    const response = await api.post(
      `${this.baseUrl}/patients/${patientId}/insurance/card-scan`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return response.data;
  }

  // ─── COB Order Detection (AI) ──────────────────────────────────

  async suggestCobOrder(
    patientId: string,
    patientContext?: { age?: number; employmentStatus?: string; hasEsrD?: boolean },
  ): Promise<{
    suggestedOrder: Array<{ insuranceId: string; priority: string; payerName: string; reason: string }>;
    confidence: number;
    rules: string[];
  }> {
    const response = await api.post(
      `${this.baseUrl}/patients/${patientId}/insurance/suggest-cob-order`,
      patientContext || {},
    );
    return response.data;
  }

  async applyCobOrder(
    patientId: string,
    order: Array<{ insuranceId: string; priority: string }>,
  ): Promise<void> {
    await api.post(`${this.baseUrl}/patients/${patientId}/insurance/apply-cob-order`, { order });
  }

  // ─── Coverage Gap Detection ────────────────────────────────────

  async scanCoverageGaps(daysAhead?: number): Promise<Array<{
    patientId: string;
    patientName: string;
    appointmentId: string;
    appointmentDate: string;
    gapType: string;
    severity: string;
    details: string;
    recommendedAction: string;
  }>> {
    const response = await api.post(`${this.baseUrl}/coverage-gaps/scan`, { daysAhead });
    return response.data;
  }

  async checkPatientCoverageGaps(patientId: string): Promise<Array<{
    patientId: string;
    patientName: string;
    appointmentId: string;
    appointmentDate: string;
    gapType: string;
    severity: string;
    details: string;
    recommendedAction: string;
  }>> {
    const response = await api.get(`${this.baseUrl}/patients/${patientId}/coverage-gaps`);
    return response.data;
  }

  // ─── AI Secondary Claim Generation ──────────────────────────────

  async analyzeSecondaryClaim(claimId: string): Promise<{
    shouldGenerateSecondary: boolean;
    reason: string;
    secondaryInsuranceId?: string;
    secondaryPayerName?: string;
    remainingBalance?: number;
    primaryPaidAmount?: number;
    estimatedSecondaryPayment?: number;
    claimFrequency: string;
    notes: string[];
  }> {
    const response = await api.post(`${this.baseUrl}/claims/${claimId}/analyze-secondary`);
    return response.data;
  }

  async generateSecondaryClaim(claimId: string): Promise<EncounterClaim> {
    const response = await api.post(`${this.baseUrl}/claims/${claimId}/generate-secondary`);
    return response.data;
  }
}

export const billingService = new BillingService();
