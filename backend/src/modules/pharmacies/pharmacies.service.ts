import { Injectable, Logger } from '@nestjs/common';
import { IntegrationsService } from '../integrations/integrations.service';

export interface PharmacyResult {
  id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
  type: 'retail' | 'mail_order' | 'compounding' | 'hospital';
  source: 'network' | 'local';
}

const LOCAL_PHARMACIES: PharmacyResult[] = [
  { id: 'ph-001', name: 'CVS Pharmacy - Main St', address: '123 Main St', city: 'Springfield', state: 'IL', zip: '62701', phone: '(555) 100-1001', type: 'retail', source: 'local' },
  { id: 'ph-002', name: 'Walgreens - Oak Ave', address: '456 Oak Ave', city: 'Springfield', state: 'IL', zip: '62702', phone: '(555) 100-1002', type: 'retail', source: 'local' },
  { id: 'ph-003', name: 'Rite Aid - Broadway', address: '789 Broadway', city: 'Springfield', state: 'IL', zip: '62703', phone: '(555) 100-1003', type: 'retail', source: 'local' },
  { id: 'ph-004', name: 'Walmart Pharmacy', address: '1010 Commerce Dr', city: 'Springfield', state: 'IL', zip: '62704', phone: '(555) 100-1004', type: 'retail', source: 'local' },
  { id: 'ph-005', name: 'Costco Pharmacy', address: '2000 Warehouse Way', city: 'Springfield', state: 'IL', zip: '62705', phone: '(555) 100-1005', type: 'retail', source: 'local' },
  { id: 'ph-006', name: 'Express Scripts Mail Order', address: '1 Express Way', city: 'St. Louis', state: 'MO', zip: '63101', phone: '(800) 333-3333', type: 'mail_order', source: 'local' },
  { id: 'ph-007', name: 'Local Compounding Pharmacy', address: '55 Custom Ln', city: 'Springfield', state: 'IL', zip: '62701', phone: '(555) 100-1007', type: 'compounding', source: 'local' },
  { id: 'ph-008', name: 'Hospital Pharmacy - Bay Area Medical', address: '1 Medical Center Blvd', city: 'Springfield', state: 'IL', zip: '62706', phone: '(555) 100-1008', type: 'hospital', source: 'local' },
];

@Injectable()
export class PharmaciesService {
  private readonly logger = new Logger(PharmaciesService.name);

  constructor(private readonly integrationsService: IntegrationsService) {}

  async search(
    tenantId: string,
    query: string,
    limit = 25,
  ): Promise<PharmacyResult[]> {
    const q = (query || '').trim().toLowerCase();
    const networkEnabled = await this.integrationsService.isEnabled(tenantId, 'pharmacy_network');

    let results = LOCAL_PHARMACIES.filter((p) =>
      !q ||
      p.name.toLowerCase().includes(q) ||
      (p.address && p.address.toLowerCase().includes(q)) ||
      (p.zip && p.zip.includes(q)),
    );

    if (networkEnabled) {
      try {
        const network = await this.searchNetwork(q, limit);
        const seen = new Set(results.map((r) => r.id));
        results = [...network.filter((n) => !seen.has(n.id)), ...results];
      } catch (err: any) {
        this.logger.warn(`Pharmacy network search failed, using local directory: ${err.message}`);
      }
    }

    return results.slice(0, limit);
  }

  private async searchNetwork(query: string, limit: number): Promise<PharmacyResult[]> {
    // Placeholder for a real Surescripts / NCPDP pharmacy network call.
    // In production this would authenticate and call the network directory API.
    this.logger.debug(`External pharmacy network search placeholder: q=${query}, limit=${limit}`);
    return [];
  }
}
