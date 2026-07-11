import { api } from './api';

export interface Medication {
  name: string;
  rxNormCode: string;
  strengths: string[];
  source: 'rxnorm' | 'local';
}

export interface MedicationSearchResult {
  data: Medication[];
  query: string;
  total: number;
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
}

export const medicationService = new MedicationService();
