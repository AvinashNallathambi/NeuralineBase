import { Injectable, Logger } from '@nestjs/common';
import { IntegrationsService } from '../integrations/integrations.service';

export interface MedicationResult {
  name: string;
  rxNormCode: string;
  strengths: string[];
  source: 'rxnorm' | 'local';
}

const LOCAL_MEDICATIONS: MedicationResult[] = [
  { name: 'Metformin', rxNormCode: '860975', strengths: ['500mg', '850mg', '1000mg'], source: 'local' },
  { name: 'Lisinopril', rxNormCode: '314076', strengths: ['5mg', '10mg', '20mg', '40mg'], source: 'local' },
  { name: 'Atorvastatin', rxNormCode: '259255', strengths: ['10mg', '20mg', '40mg', '80mg'], source: 'local' },
  { name: 'Amlodipine', rxNormCode: '329526', strengths: ['2.5mg', '5mg', '10mg'], source: 'local' },
  { name: 'Metoprolol', rxNormCode: '866924', strengths: ['25mg', '50mg', '100mg'], source: 'local' },
  { name: 'Omeprazole', rxNormCode: '402014', strengths: ['20mg', '40mg'], source: 'local' },
  { name: 'Sertraline', rxNormCode: '312940', strengths: ['25mg', '50mg', '100mg'], source: 'local' },
  { name: 'Amoxicillin', rxNormCode: '308182', strengths: ['250mg', '500mg', '875mg'], source: 'local' },
  { name: 'Levothyroxine', rxNormCode: '966222', strengths: ['25mcg', '50mcg', '75mcg', '100mcg', '125mcg'], source: 'local' },
  { name: 'Gabapentin', rxNormCode: '310429', strengths: ['100mg', '300mg', '400mg', '600mg'], source: 'local' },
  { name: 'Losartan', rxNormCode: '979480', strengths: ['25mg', '50mg', '100mg'], source: 'local' },
  { name: 'Furosemide', rxNormCode: '310429', strengths: ['20mg', '40mg', '80mg'], source: 'local' },
  { name: 'Prednisone', rxNormCode: '312615', strengths: ['5mg', '10mg', '20mg'], source: 'local' },
  { name: 'Albuterol Inhaler', rxNormCode: '245314', strengths: ['90mcg/actuation'], source: 'local' },
  { name: 'Insulin Glargine', rxNormCode: '261542', strengths: ['100 units/mL'], source: 'local' },
  { name: 'Hydrochlorothiazide', rxNormCode: '310798', strengths: ['12.5mg', '25mg', '50mg'], source: 'local' },
  { name: 'Pantoprazole', rxNormCode: '402014', strengths: ['20mg', '40mg'], source: 'local' },
  { name: 'Escitalopram', rxNormCode: '352741', strengths: ['5mg', '10mg', '20mg'], source: 'local' },
];

@Injectable()
export class MedicationsService {
  private readonly logger = new Logger(MedicationsService.name);

  constructor(private readonly integrationsService: IntegrationsService) {}

  async search(
    tenantId: string,
    query: string,
    limit = 25,
  ): Promise<MedicationResult[]> {
    const q = (query || '').trim().toLowerCase();
    const rxNormEnabled = await this.integrationsService.isEnabled(tenantId, 'rxnorm');

    let localResults = LOCAL_MEDICATIONS;
    if (q) {
      localResults = LOCAL_MEDICATIONS.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.rxNormCode.includes(q),
      );
    }

    if (!rxNormEnabled || q.length < 2) {
      return localResults.slice(0, limit);
    }

    try {
      const external = await this.searchRxNorm(q, limit);
      // Merge external results first, then local fallback if external returned few.
      const seen = new Set(external.map((e) => e.name.toLowerCase()));
      return [...external, ...localResults.filter((m) => !seen.has(m.name.toLowerCase()))].slice(0, limit);
    } catch (err: any) {
      this.logger.warn(`RxNorm search failed, falling back to local list: ${err.message}`);
      return localResults.slice(0, limit);
    }
  }

  private async searchRxNorm(query: string, limit: number): Promise<MedicationResult[]> {
    const url = `https://rxnav.nlm.nih.gov/REST/approximateTerm.json?term=${encodeURIComponent(query)}&maxEntries=${limit}`;
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) {
      throw new Error(`RxNorm returned ${res.status}`);
    }
    const data: any = await res.json();
    const concepts: any[] = data?.approximateGroup?.conceptProperties || [];

    const results: MedicationResult[] = [];
    for (const concept of concepts.slice(0, limit)) {
      const rxcui = String(concept.rxcui);
      const name = concept.name as string;
      if (!rxcui || !name) continue;
      const strengths = await this.fetchStrengths(rxcui);
      results.push({ name, rxNormCode: rxcui, strengths, source: 'rxnorm' });
    }
    return results;
  }

  private async fetchStrengths(rxcui: string): Promise<string[]> {
    try {
      const url = `https://rxnav.nlm.nih.gov/REST/RxTerms/rxcui/${rxcui}/allinfo.json`;
      const res = await fetch(url, { method: 'GET' });
      if (!res.ok) return [];
      const data: any = await res.json();
      const prop = data?.rxtermsProperties;
      if (prop?.strength) {
        return String(prop.strength).split(/;|,/).map((s: string) => s.trim()).filter(Boolean);
      }
      return [];
    } catch {
      return [];
    }
  }
}
