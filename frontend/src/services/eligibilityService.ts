import { api } from './api';
import type {
  EligibilityVerification,
  CoverageSummary,
  CreateEligibilityVerificationDto,
  EligibilityQuery,
} from '../types';

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface EligibilityCounts {
  total: number;
  active: number;
  pending: number;
  inactive: number;
  failed: number;
  error: number;
}

class EligibilityService {
  private baseUrl = 'eligibility/verifications';

  async findAll(query: EligibilityQuery = {}): Promise<PaginatedResult<EligibilityVerification>> {
    const response = await api.get(this.baseUrl, { params: query });
    return response.data;
  }

  async findOne(id: string): Promise<EligibilityVerification> {
    const response = await api.get(`${this.baseUrl}/${id}`);
    return response.data;
  }

  async create(dto: CreateEligibilityVerificationDto): Promise<EligibilityVerification> {
    const response = await api.post(this.baseUrl, dto);
    return response.data;
  }

  async rerun(id: string): Promise<EligibilityVerification> {
    const response = await api.post(`${this.baseUrl}/${id}/rerun`);
    return response.data;
  }

  async update(id: string, updates: Partial<CreateEligibilityVerificationDto>): Promise<EligibilityVerification> {
    const response = await api.patch(`${this.baseUrl}/${id}`, updates);
    return response.data;
  }

  async delete(id: string): Promise<void> {
    await api.delete(`${this.baseUrl}/${id}`);
  }

  async findHistoryByPatient(patientId: string, query: EligibilityQuery = {}): Promise<PaginatedResult<EligibilityVerification>> {
    const response = await api.get(`${this.baseUrl}/patients/${patientId}/history`, { params: query });
    return response.data;
  }

  async coverageSummary(patientId: string): Promise<CoverageSummary | null> {
    const response = await api.get(`${this.baseUrl}/patients/${patientId}/coverage`);
    return response.data;
  }

  async getCounts(): Promise<EligibilityCounts> {
    const response = await api.get(`${this.baseUrl}/counts`);
    return response.data;
  }

  async batchVerify(patientIds: string[]): Promise<EligibilityVerification[]> {
    const response = await api.post(`${this.baseUrl}/batch`, { patientIds });
    return response.data;
  }

  // ─── AI Eligibility Features ─────────────────────────────────────
  // AI calls can take up to 60s, so we use a longer timeout.

  async generateAlerts(verificationId: string): Promise<{
    alerts: Array<{ severity: 'info' | 'warning' | 'critical'; category: string; message: string; action: string }>;
    summary: string;
  }> {
    const response = await api.post(`/eligibility/ai/alerts/${verificationId}`, undefined, { timeout: 120000 });
    return response.data;
  }

  async generateSummary(verificationId: string): Promise<{ summary: string }> {
    const response = await api.post(`/eligibility/ai/summary/${verificationId}`, undefined, { timeout: 120000 });
    return response.data;
  }

  async estimateResponsibility(verificationId: string, cptCodes?: string[]): Promise<{
    estimates: Array<{ cptCode: string; description: string; allowedAmount: number; patientResponsibility: number; payerResponsibility: number }>;
    totalPatientResponsibility: number;
    notes: string;
  }> {
    const response = await api.post(`/eligibility/ai/estimate-responsibility/${verificationId}`, { cptCodes }, { timeout: 120000 });
    return response.data;
  }

  async assessDenialRisk(verificationId: string): Promise<{
    riskLevel: 'low' | 'medium' | 'high';
    riskScore: number;
    riskFactors: Array<{ factor: string; severity: string; recommendation: string }>;
    summary: string;
  }> {
    const response = await api.post(`/eligibility/ai/denial-risk/${verificationId}`, undefined, { timeout: 120000 });
    return response.data;
  }

  async generatePriorAuthLetter(verificationId: string): Promise<{ letter: string }> {
    const response = await api.post(`/eligibility/ai/prior-auth/${verificationId}`, undefined, { timeout: 120000 });
    return response.data;
  }

  async parse271(verificationId: string): Promise<{ parsed: Record<string, unknown>; summary: string }> {
    const response = await api.post(`/eligibility/ai/parse-271/${verificationId}`, undefined, { timeout: 120000 });
    return response.data;
  }
}

export const eligibilityService = new EligibilityService();
