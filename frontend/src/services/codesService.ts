import { api } from './api';

export type CodeSystem =
  | 'ICD-10-CM'
  | 'ICD-9-CM'
  | 'SNOMED CT'
  | 'ICD-11'
  | 'CPT'
  | 'HCPCS'
  | 'LOINC'
  | 'CUSTOM';

export interface UnifiedCodeResult {
  code: string;
  description: string;
  codeSystem: string;
  category?: string | null;
  isBillable?: boolean;
  isProcedure?: boolean;
}

export interface UnifiedCodeSearchResult {
  query: string;
  results: UnifiedCodeResult[];
  grouped: Record<string, UnifiedCodeResult[]>;
}

export const codesService = {
  async search(q: string, types?: string[], limit = 25): Promise<UnifiedCodeSearchResult> {
    const params: Record<string, unknown> = { q, limit };
    if (types && types.length > 0) {
      params.types = types.join(',');
    }
    const res = await api.get('/codes/search', { params });
    return res.data;
  },
};
