import { api } from './api';

export interface IcdCode {
  id: string;
  code: string;
  description: string;
  category?: string | null;
  chapter?: number | null;
  chapterTitle?: string | null;
  isBillable: boolean;
  isHeader: boolean;
}

export interface IcdSearchResult {
  data: IcdCode[];
  total: number;
  query: string;
}

export interface PatientProblem {
  id: string;
  tenantId: string;
  patientId: string;
  code: string;
  codeSystem: 'ICD-10-CM' | 'SNOMED CT' | 'ICD-11';
  description: string;
  clinicalStatus: 'active' | 'inactive' | 'resolved';
  verificationStatus: 'confirmed' | 'unconfirmed' | 'refuted' | 'entered-in-error';
  priority?: 'primary' | 'secondary' | null;
  isChronic: boolean;
  onsetDate?: string;
  resolutionDate?: string;
  recordedBy?: string | null;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FavoriteDiagnosis {
  id: string;
  tenantId: string;
  providerId?: string | null;
  code: string;
  codeSystem: 'ICD-10-CM' | 'SNOMED CT' | 'ICD-11';
  description: string;
  isBillable: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RecentDiagnosis {
  code: string;
  codeSystem: 'ICD-10-CM' | 'SNOMED CT' | 'ICD-11';
  description: string;
  encounterDate?: string;
}

export interface UnifiedSearchResult {
  query: string;
  patientActiveProblems: PatientProblem[];
  favoriteDiagnoses: FavoriteDiagnosis[];
  icd10Results: IcdCode[];
  recentDiagnoses: RecentDiagnosis[];
}

export const icdService = {
  async search(q: string, limit = 25, offset = 0): Promise<IcdSearchResult> {
    const res = await api.get('/icd/search', { params: { q, limit, offset } });
    return res.data;
  },

  async unifiedSearch(q: string, patientId?: string, providerId?: string, limit = 25): Promise<UnifiedSearchResult> {
    const res = await api.get('/icd/unified-search', { params: { q, patientId, providerId, limit } });
    return res.data;
  },

  async lookup(code: string): Promise<{ found: boolean; data?: IcdCode; code: string }> {
    const res = await api.get(`/icd/${encodeURIComponent(code)}`);
    return res.data;
  },

  async findFavorites(providerId?: string): Promise<FavoriteDiagnosis[]> {
    const res = await api.get('/icd/favorites', { params: { providerId } });
    return res.data;
  },

  async createFavorite(data: { code: string; description: string; codeSystem?: string; isBillable?: boolean }): Promise<FavoriteDiagnosis> {
    const res = await api.post('/icd/favorites', data);
    return res.data;
  },

  async removeFavorite(id: string): Promise<void> {
    await api.delete(`/icd/favorites/${id}`);
  },
};
