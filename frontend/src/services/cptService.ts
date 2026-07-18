import { api } from './api';

export interface CptCode {
  id: string;
  code: string;
  description: string;
  category?: string | null;
  defaultCharge?: number | null;
  workRvu?: number | null;
  isActive: boolean;
}

export interface CptSearchResult {
  data: CptCode[];
  total: number;
  query: string;
}

export const cptService = {
  async search(q: string, limit = 25, offset = 0): Promise<CptSearchResult> {
    const res = await api.get('/cpt/search', { params: { q, limit, offset } });
    return res.data;
  },

  async lookup(code: string): Promise<{ found: boolean; data?: CptCode; code: string }> {
    const res = await api.get(`/cpt/${encodeURIComponent(code)}`);
    return res.data;
  },
};
