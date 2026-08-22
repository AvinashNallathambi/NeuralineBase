import { api } from './api';
import type {
  Episode,
  EpisodeDashboard,
  EpisodeStatus,
  EpisodeType,
  EpisodeCondition,
} from '../types';

const BASE = '/episodes';

export const episodeService = {
  async create(data: {
    patientId: string;
    patientName: string;
    title: string;
    description?: string;
    episodeType: EpisodeType;
    status?: EpisodeStatus;
    conditions?: EpisodeCondition[];
    managingProviderId?: string;
    managingProviderName?: string;
    startDate: string;
    endDate?: string;
    encounterIds?: string[];
    carePlanIds?: string[];
    tags?: string[];
    notes?: string;
  }): Promise<Episode> {
    const response = await api.post(`${BASE}`, data);
    return response.data;
  },

  async list(params?: { patientId?: string; status?: EpisodeStatus; includeInactive?: boolean }): Promise<Episode[]> {
    const response = await api.get(`${BASE}`, { params });
    return response.data;
  },

  async getDashboard(): Promise<EpisodeDashboard> {
    const response = await api.get(`${BASE}/dashboard`);
    return response.data;
  },

  async getOne(id: string): Promise<Episode> {
    const response = await api.get(`${BASE}/${id}`);
    return response.data;
  },

  async update(id: string, data: Partial<{
    title: string;
    description: string;
    episodeType: EpisodeType;
    status: EpisodeStatus;
    conditions: EpisodeCondition[];
    endDate: string;
    tags: string[];
    notes: string;
  }>): Promise<Episode> {
    const response = await api.patch(`${BASE}/${id}`, data);
    return response.data;
  },

  async close(id: string, data: {
    clinicalOutcome: string;
    patientSatisfaction?: number;
    qualityMeasureCompliance?: number;
    notes?: string;
    assessedBy: string;
  }): Promise<Episode> {
    const response = await api.post(`${BASE}/${id}/close`, data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`${BASE}/${id}`);
  },

  async linkEncounter(id: string, encounterId: string): Promise<Episode> {
    const response = await api.post(`${BASE}/${id}/encounters`, { encounterId });
    return response.data;
  },

  async unlinkEncounter(id: string, encounterId: string): Promise<Episode> {
    const response = await api.delete(`${BASE}/${id}/encounters/${encounterId}`);
    return response.data;
  },

  async linkCarePlan(id: string, carePlanId: string): Promise<Episode> {
    const response = await api.post(`${BASE}/${id}/care-plans`, { carePlanId });
    return response.data;
  },

  async unlinkCarePlan(id: string, carePlanId: string): Promise<Episode> {
    const response = await api.delete(`${BASE}/${id}/care-plans/${carePlanId}`);
    return response.data;
  },

  async calculateCosts(id: string): Promise<Episode> {
    const response = await api.post(`${BASE}/${id}/calculate-costs`, {});
    return response.data;
  },

  // ── AI Features ───────────────────────────────────────────────────
  async autoDetect(patientId: string, encounters: any[]): Promise<any> {
    const response = await api.post(`${BASE}/auto-detect`, { patientId, encounters });
    return response.data;
  },

  async predictCost(id: string): Promise<Episode> {
    const response = await api.post(`${BASE}/${id}/predict-cost`, {});
    return response.data;
  },

  async detectDeviations(id: string): Promise<Episode> {
    const response = await api.post(`${BASE}/${id}/detect-deviations`, {});
    return response.data;
  },

  async generateSummary(id: string): Promise<{ summary: string; keyEvents: string[]; outcomes: string; recommendations: string[] }> {
    const response = await api.post(`${BASE}/${id}/summary`, {});
    return response.data;
  },
};
