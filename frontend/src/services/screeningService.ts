import { api } from './api';
import type {
  ScreeningInstrument,
  ScreeningResult,
  ScreeningDashboard,
  InstrumentCategory,
} from '../types';

const BASE = '/api/v1/screening';

export const screeningService = {
  // ── Instruments ─────────────────────────────────────────────────
  async listInstruments(category?: InstrumentCategory): Promise<ScreeningInstrument[]> {
    const response = await api.get(`${BASE}/instruments`, { params: { category } });
    return response.data;
  },

  async getInstrument(id: string): Promise<ScreeningInstrument> {
    const response = await api.get(`${BASE}/instruments/${id}`);
    return response.data;
  },

  async seedInstruments(): Promise<{ seeded: number; message: string }> {
    const response = await api.post(`${BASE}/instruments/seed`, {});
    return response.data;
  },

  async createCustomInstrument(data: {
    code: string;
    title: string;
    description?: string;
    category: InstrumentCategory;
    questions: any[];
    scoringRules?: any;
    administrationRules?: any;
    estimatedMinutes?: number;
  }): Promise<ScreeningInstrument> {
    const response = await api.post(`${BASE}/instruments`, data);
    return response.data;
  },

  async updateInstrument(id: string, data: any): Promise<ScreeningInstrument> {
    const response = await api.patch(`${BASE}/instruments/${id}`, data);
    return response.data;
  },

  // ── Screening Administration ────────────────────────────────────
  async startScreening(data: {
    instrumentId: string;
    patientId: string;
    patientName: string;
    encounterId?: string;
    administrationContext?: 'pre_visit_portal' | 'in_visit_tablet' | 'in_visit_staff' | 'telehealth';
  }): Promise<ScreeningResult> {
    const response = await api.post(`${BASE}/start`, data);
    return response.data;
  },

  async saveProgress(resultId: string, answers: Array<{ questionId: string; answerValue: string }>): Promise<ScreeningResult> {
    const response = await api.post(`${BASE}/${resultId}/save-progress`, { answers });
    return response.data;
  },

  async submitScreening(resultId: string, data: {
    answers: Array<{ questionId: string; answerValue: string }>;
    notes?: string;
  }): Promise<ScreeningResult> {
    const response = await api.post(`${BASE}/${resultId}/submit`, data);
    return response.data;
  },

  async discontinue(resultId: string): Promise<ScreeningResult> {
    const response = await api.post(`${BASE}/${resultId}/discontinue`, {});
    return response.data;
  },

  // ── Results ─────────────────────────────────────────────────────
  async getResults(params?: { patientId?: string; instrumentCode?: string }): Promise<ScreeningResult[] | ScreeningDashboard> {
    const response = await api.get(`${BASE}/results`, { params });
    return response.data;
  },

  async getResult(id: string): Promise<ScreeningResult> {
    const response = await api.get(`${BASE}/results/${id}`);
    return response.data;
  },

  async getScoreTrend(patientId: string, instrumentCode: string): Promise<ScreeningResult[]> {
    const response = await api.get(`${BASE}/trend`, { params: { patientId, instrumentCode } });
    return response.data;
  },

  async getDashboard(): Promise<ScreeningDashboard> {
    const response = await api.get(`${BASE}/dashboard`);
    return response.data;
  },

  // ── AI Features ─────────────────────────────────────────────────
  async recommendInstruments(data: {
    patientId: string;
    age: number;
    sex: string;
    chiefComplaint?: string;
    activeDiagnoses: string[];
    recentScreenings: any[];
  }): Promise<any> {
    const response = await api.post(`${BASE}/ai/recommend`, data);
    return response.data;
  },

  async interpretScore(resultId: string, data: {
    age: number;
    sex: string;
    activeDiagnoses: string[];
  }): Promise<any> {
    const response = await api.post(`${BASE}/results/${resultId}/interpret`, data);
    return response.data;
  },

  async riskStratification(data: {
    patientId: string;
    age: number;
    sex: string;
    activeDiagnoses: string[];
    medications: string[];
  }): Promise<any> {
    const response = await api.post(`${BASE}/ai/risk-stratification`, data);
    return response.data;
  },
};
