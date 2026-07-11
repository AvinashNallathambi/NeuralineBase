import { api } from './api';

export type PharmacyType = 'retail' | 'mail_order' | 'compounding' | 'hospital';

export interface Pharmacy {
  id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
  type: PharmacyType;
  source: 'network' | 'local';
}

export interface PharmacySearchResult {
  data: Pharmacy[];
  query: string;
  total: number;
}

class PharmacyService {
  private baseUrl = '/pharmacies';

  async search(query: string, limit = 25): Promise<PharmacySearchResult> {
    const params = new URLSearchParams();
    params.append('q', query);
    params.append('limit', limit.toString());
    const response = await api.get(`${this.baseUrl}/search?${params.toString()}`);
    return response.data;
  }
}

export const pharmacyService = new PharmacyService();
