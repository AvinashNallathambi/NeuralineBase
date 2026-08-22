import { api } from './api';

export type PharmacyType = 'retail' | 'mail_order' | 'compounding' | 'hospital' | 'specialty';

export interface Pharmacy {
  id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
  fax?: string;
  type: PharmacyType;
  source: 'network' | 'local' | 'nppes';
  /** NPI number (present when source='nppes') */
  npi?: string;
  /** Taxonomy code (present when source='nppes') */
  taxonomyCode?: string;
}

export interface PharmacySearchResult {
  data: Pharmacy[];
  query: string;
  total: number;
}

// ── NPPES types ──────────────────────────────────────────────────────────────

export interface NPPESPharmacy {
  npi: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
  fax?: string;
  taxonomyCode?: string;
  taxonomyDescription?: string;
  type: PharmacyType;
  source: 'nppes';
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

  // ── NPPES methods ──────────────────────────────────────────────────────────

  async searchNPPES(query: string, limit = 25): Promise<{ data: NPPESPharmacy[]; query: string; total: number }> {
    const params = new URLSearchParams();
    params.append('q', query);
    params.append('limit', limit.toString());
    const response = await api.get(`${this.baseUrl}/nppes/search?${params.toString()}`);
    return response.data;
  }

  async getPharmacyByNPI(npi: string): Promise<{ data: NPPESPharmacy | null }> {
    const params = new URLSearchParams();
    params.append('npi', npi);
    const response = await api.get(`${this.baseUrl}/nppes/${npi}?${params.toString()}`);
    return response.data;
  }
}

export const pharmacyService = new PharmacyService();
