import { Injectable, Logger } from '@nestjs/common';
import { IntegrationsService } from '../integrations/integrations.service';

/**
 * NPPES NPI Registry provides a FREE, public directory of ALL US healthcare
 * providers, including pharmacies. No API key required.
 *
 * API docs: https://npiregistry.cms.hhs.gov/registry/help-api
 * Endpoint: https://npiregistry.cms.hhs.gov/api/
 *
 * Pharmacies are identified by taxonomy codes:
 *   3336C0003X — Community/Retail Pharmacy
 *   3336H0003X — Hospital Pharmacy
 *   3336S0011X — Specialty Pharmacy
 *   3336M0002X — Mail Order Pharmacy
 *   3336I0012X — Institutional Pharmacy
 *   3336L0003X — Long Term Care Pharmacy
 *   3336N0007X — Nuclear Pharmacy
 *   3336C0001X — Compounding Pharmacy
 *   3336C0004X — Clinic Pharmacy
 *   3336C0005X — Disease Management Pharmacy
 */

/** Pharmacy taxonomy codes mapped to our internal types. */
const PHARMACY_TAXONOMY_MAP: Record<string, 'retail' | 'mail_order' | 'compounding' | 'hospital' | 'specialty'> = {
  '3336C0003X': 'retail',       // Community/Retail Pharmacy
  '3336H0003X': 'hospital',     // Hospital Pharmacy
  '3336S0011X': 'specialty',    // Specialty Pharmacy
  '3336M0002X': 'mail_order',   // Mail Order Pharmacy
  '3336I0012X': 'hospital',     // Institutional Pharmacy
  '3336L0003X': 'hospital',     // Long Term Care Pharmacy
  '3336N0007X': 'specialty',    // Nuclear Pharmacy
  '3336C0001X': 'compounding',  // Compounding Pharmacy
  '3336C0004X': 'hospital',     // Clinic Pharmacy
  '3336C0005X': 'specialty',    // Disease Management Pharmacy
};

/** All pharmacy taxonomy codes for broad search. */
const ALL_PHARMACY_TAXONOMIES = Object.keys(PHARMACY_TAXONOMY_MAP);

export interface NPPESPharmacyResult {
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
  type: 'retail' | 'mail_order' | 'compounding' | 'hospital' | 'specialty';
  source: 'nppes';
}

const NPPES_BASE_URL = 'https://npiregistry.cms.hhs.gov/api/';

@Injectable()
export class NPPESPharmacyService {
  private readonly logger = new Logger(NPPESPharmacyService.name);

  constructor(private readonly integrationsService: IntegrationsService) {}

  async isEnabled(tenantId: string): Promise<boolean> {
    return this.integrationsService.isEnabled(tenantId, 'nppes_pharmacy');
  }

  /**
   * Search the NPPES NPI Registry for pharmacies.
   * Can search by name, city, state, or zip.
   * Returns real US pharmacies with NPI numbers.
   */
  async searchPharmacies(
    tenantId: string,
    query: string,
    limit = 25,
  ): Promise<NPPESPharmacyResult[]> {
    if (!(await this.isEnabled(tenantId))) return [];
    const q = (query || '').trim();
    if (q.length < 2) return [];

    try {
      // Try searching by organization name first
      const results = await this.searchByOrgName(q, limit);
      if (results.length > 0) return results;

      // If no org name results, try by city/state/zip
      return await this.searchByLocation(q, limit);
    } catch (err: any) {
      this.logger.warn(`NPPES pharmacy search failed: ${err.message}`);
      return [];
    }
  }

  /**
   * Search pharmacies near a specific location (city, state, or zip).
   */
  async searchByLocation(
    location: string,
    limit: number,
  ): Promise<NPPESPharmacyResult[]> {
    const params = new URLSearchParams({
      version: '2.1',
      limit: String(Math.min(limit, 200)),
      taxonomy_description: 'Pharmacy',
    });

    // Detect if query is a zip code (5 digits)
    if (/^\d{5}(-\d{4})?$/.test(location)) {
      params.set('postal_code', location);
    } else if (/^[A-Za-z]{2},\s*[A-Za-z\s]+$/.test(location)) {
      // "City, ST" format
      const [city, state] = location.split(',').map((s) => s.trim());
      params.set('city', city);
      params.set('state', state);
    } else if (/^[A-Za-z]{2}$/.test(location.toUpperCase())) {
      params.set('state', location.toUpperCase());
    } else {
      params.set('city', location);
    }

    const url = `${NPPES_BASE_URL}?${params.toString()}`;
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) {
      throw new Error(`NPPES returned ${res.status}`);
    }
    const data: any = await res.json();
    const results: any[] = data?.results || [];
    return results
      .filter((r) => this.isPharmacy(r))
      .map((r) => this.parsePharmacy(r))
      .slice(0, limit);
  }

  /**
   * Search pharmacies by organization name.
   */
  private async searchByOrgName(
    name: string,
    limit: number,
  ): Promise<NPPESPharmacyResult[]> {
    const params = new URLSearchParams({
      version: '2.1',
      organization_name: name,
      limit: String(Math.min(limit, 200)),
    });

    const url = `${NPPES_BASE_URL}?${params.toString()}`;
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) {
      throw new Error(`NPPES returned ${res.status}`);
    }
    const data: any = await res.json();
    const results: any[] = data?.results || [];
    return results
      .filter((r) => this.isPharmacy(r))
      .map((r) => this.parsePharmacy(r))
      .slice(0, limit);
  }

  /**
   * Get a specific pharmacy by NPI number.
   */
  async getPharmacyByNpi(
    tenantId: string,
    npi: string,
  ): Promise<NPPESPharmacyResult | null> {
    if (!(await this.isEnabled(tenantId))) return null;
    if (!npi) return null;

    const params = new URLSearchParams({
      version: '2.1',
      number: npi,
    });

    const url = `${NPPES_BASE_URL}?${params.toString()}`;
    try {
      const res = await fetch(url, { method: 'GET' });
      if (!res.ok) return null;
      const data: any = await res.json();
      const result = data?.results?.[0];
      if (!result || !this.isPharmacy(result)) return null;
      return this.parsePharmacy(result);
    } catch (err: any) {
      this.logger.warn(`NPPES pharmacy lookup by NPI failed: ${err.message}`);
      return null;
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /** Check if an NPPES result is a pharmacy (by taxonomy code). */
  private isPharmacy(result: any): boolean {
    const taxonomies = result?.taxonomies || [];
    return taxonomies.some((t: any) =>
      ALL_PHARMACY_TAXONOMIES.includes(t.code) || (t.desc && t.desc.toLowerCase().includes('pharmacy')),
    );
  }

  /** Parse an NPPES result into our pharmacy format. */
  private parsePharmacy(result: any): NPPESPharmacyResult {
    const taxonomies = result?.taxonomies || [];
    const pharmacyTaxonomy = taxonomies.find(
      (t: any) => ALL_PHARMACY_TAXONOMIES.includes(t.code) || (t.desc && t.desc.toLowerCase().includes('pharmacy')),
    );

    const taxonomyCode = pharmacyTaxonomy?.code;
    const type = taxonomyCode ? PHARMACY_TAXONOMY_MAP[taxonomyCode] || 'retail' : 'retail';

    const address = result?.addresses?.find((a: any) => a.address_purpose === 'LOCATION') ||
                    result?.addresses?.find((a: any) => a.address_purpose === 'MAILING') ||
                    result?.addresses?.[0] || {};

    return {
      npi: result?.number || '',
      name: result?.basic?.organization_name || 'Unknown Pharmacy',
      address: address.address_1 || undefined,
      city: address.city || undefined,
      state: address.state || undefined,
      zip: address.postal_code || undefined,
      phone: address.telephone_number || undefined,
      fax: address.fax_number || undefined,
      taxonomyCode,
      taxonomyDescription: pharmacyTaxonomy?.desc,
      type,
      source: 'nppes',
    };
  }
}
