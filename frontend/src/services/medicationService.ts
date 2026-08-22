import { api } from './api';

export interface Medication {
  name: string;
  rxNormCode: string;
  strengths: string[];
  source: 'rxnorm' | 'local' | 'openfda';
  /** Additional fields from OpenFDA */
  genericName?: string;
  brandName?: string;
  manufacturer?: string;
  ndc?: string[];
  productType?: string;
  deaSchedule?: string;
}

export interface MedicationSearchResult {
  data: Medication[];
  query: string;
  total: number;
}

// ── OpenFDA types ──────────────────────────────────────────────────────────────

export interface OpenFDADrug {
  id: string;
  name: string;
  genericName?: string;
  brandName?: string;
  manufacturer?: string;
  activeIngredients: string[];
  strength?: string;
  dosageForm?: string;
  route?: string;
  ndc: string[];
  rxNormCode?: string;
  deaSchedule?: string;
  productType?: string;
  source: 'openfda';
}

export interface OpenFDAAdverseEvent {
  safetyReportId: string;
  serious: boolean;
  patientAge?: string;
  patientSex?: string;
  reactions: string[];
  outcomes: string[];
  drugNames: string[];
  receivedDate?: string;
}

export interface OpenFDARecall {
  recallNumber: string;
  status: string;
  classification: string;
  productDescription: string;
  reasonForRecall: string;
  recallingFirm: string;
  distributionPattern?: string;
  recallInitiationDate?: string;
  city?: string;
  state?: string;
  country?: string;
}

export interface OpenFDALabelInfo {
  id: string;
  brandName?: string;
  genericName?: string;
  manufacturer?: string;
  ndc: string[];
  purpose?: string;
  indicationsAndUsage?: string;
  warnings?: string;
  dosageAndAdministration?: string;
  contraindications?: string;
  adverseReactions?: string;
  drugInteractions?: string;
  pregnancyOrBreastFeeding?: string;
  activeIngredients: string[];
  inactiveIngredients?: string[];
  deaSchedule?: string;
  productType?: string;
}

// ── DailyMed types ──────────────────────────────────────────────────────────────

export interface DailyMedSearchResult {
  title: string;
  splVersion: string;
  publishedDate: string;
  id: string;
  url: string;
}

export interface DailyMedLabelInfo {
  title: string;
  setId: string;
  versionNumber: string;
  publishedDate: string;
  effectiveTime: string;
  sections: { title: string; text: string }[];
  activeIngredients: string[];
  inactiveIngredients: string[];
  ndc: string[];
  rxNormCode?: string;
}

class MedicationService {
  private baseUrl = '/medications';

  async search(query: string, limit = 25): Promise<MedicationSearchResult> {
    const params = new URLSearchParams();
    params.append('q', query);
    params.append('limit', limit.toString());
    const response = await api.get(`${this.baseUrl}/search?${params.toString()}`);
    return response.data;
  }

  // ── OpenFDA methods ──────────────────────────────────────────────────────────

  async searchOpenFDA(query: string, limit = 25): Promise<{ data: OpenFDADrug[]; query: string; total: number }> {
    const params = new URLSearchParams();
    params.append('q', query);
    params.append('limit', limit.toString());
    const response = await api.get(`${this.baseUrl}/openfda/search?${params.toString()}`);
    return response.data;
  }

  async getDrugLabel(query: string): Promise<{ data: OpenFDALabelInfo | null; query: string }> {
    const params = new URLSearchParams();
    params.append('q', query);
    const response = await api.get(`${this.baseUrl}/openfda/label?${params.toString()}`);
    return response.data;
  }

  async searchAdverseEvents(query: string, limit = 25): Promise<{ data: OpenFDAAdverseEvent[]; query: string; total: number }> {
    const params = new URLSearchParams();
    params.append('q', query);
    params.append('limit', limit.toString());
    const response = await api.get(`${this.baseUrl}/openfda/adverse-events?${params.toString()}`);
    return response.data;
  }

  async searchRecalls(query: string, limit = 25): Promise<{ data: OpenFDARecall[]; query: string; total: number }> {
    const params = new URLSearchParams();
    params.append('q', query);
    params.append('limit', limit.toString());
    const response = await api.get(`${this.baseUrl}/openfda/recalls?${params.toString()}`);
    return response.data;
  }

  // ── DailyMed methods ──────────────────────────────────────────────────────────

  async searchDailyMed(query: string, limit = 25): Promise<{ data: DailyMedSearchResult[]; query: string; total: number }> {
    const params = new URLSearchParams();
    params.append('q', query);
    params.append('limit', limit.toString());
    const response = await api.get(`${this.baseUrl}/dailymed/search?${params.toString()}`);
    return response.data;
  }

  async getDailyMedLabel(setId: string): Promise<{ data: DailyMedLabelInfo | null }> {
    const params = new URLSearchParams();
    params.append('setId', setId);
    const response = await api.get(`${this.baseUrl}/dailymed/label/${setId}?${params.toString()}`);
    return response.data;
  }
}

export const medicationService = new MedicationService();
