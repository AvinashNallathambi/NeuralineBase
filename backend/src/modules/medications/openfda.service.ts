import { Injectable, Logger } from '@nestjs/common';
import { IntegrationsService } from '../integrations/integrations.service';

/**
 * OpenFDA drug data result — richer than RxNorm for label/safety info.
 * Includes NDC codes, adverse events, recalls, and full prescribing labels.
 */
export interface OpenFDADrugResult {
  id: string;
  name: string;
  genericName?: string;
  brandName?: string;
  manufacturer?: string;
  activeIngredients: string[];
  strength?: string;
  dosageForm?: string;
  route?: string;
  ndc: string[];
  rxNormCode?: string;
  deaSchedule?: string;
  /** Whether the product is OTC, prescription, or both. */
  productType?: string;
  source: 'openfda';
}

export interface OpenFDAAdverseEvent {
  safetyReportId: string;
  serious: boolean;
  patientAge?: string;
  patientSex?: string;
  reactions: string[];
  outcomes: string[];
  drugNames: string[];
  receivedDate?: string;
}

export interface OpenFDARecall {
  recallNumber: string;
  status: string;
  classification: string;
  productDescription: string;
  reasonForRecall: string;
  recallingFirm: string;
  distributionPattern?: string;
  recallInitiationDate?: string;
  city?: string;
  state?: string;
  country?: string;
}

export interface OpenFDALabelInfo {
  id: string;
  brandName?: string;
  genericName?: string;
  manufacturer?: string;
  ndc: string[];
  purpose?: string;
  indicationsAndUsage?: string;
  warnings?: string;
  dosageAndAdministration?: string;
  contraindications?: string;
  adverseReactions?: string;
  drugInteractions?: string;
  pregnancyOrBreastFeeding?: string;
  activeIngredients: string[];
  inactiveIngredients?: string[];
  deaSchedule?: string;
  productType?: string;
}

const OPENFDA_BASE_URL = 'https://api.fda.gov';
const DEFAULT_LIMIT = 25;
/** Without an API key, OpenFDA allows 240 requests/minute (40/minute per IP without key). */
const RATE_LIMIT_DELAY_MS = 1500;
let lastRequestTime = 0;

/**
 * OpenFDA service — provides FREE access to:
 *   - Drug labels (structured product labels / SPL)
 *   - Adverse event reports (FAERS)
 *   - Drug recalls (enforcement reports)
 *   - NDC directory (all FDA-approved drugs including gene therapies)
 *
 * No API key required (optional key increases rate limits).
 * Data source: https://open.fda.gov
 */
@Injectable()
export class OpenFDAService {
  private readonly logger = new Logger(OpenFDAService.name);

  constructor(private readonly integrationsService: IntegrationsService) {}

  /** Check if OpenFDA integration is enabled for this tenant. */
  async isEnabled(tenantId: string): Promise<boolean> {
    return this.integrationsService.isEnabled(tenantId, 'openfda');
  }

  /** Get the API key if configured, otherwise undefined (free tier). */
  private async getApiKey(tenantId: string): Promise<string | undefined> {
    try {
      const creds = await this.integrationsService.getIntegrationCredentials(tenantId, 'openfda');
      return creds?.apiKey as string | undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Search the NDC directory AND drug labels for drugs by name.
   * Covers ALL FDA-approved drugs including gene therapies, biologics, and specialty kits.
   * The NDC endpoint has package-level data; the label endpoint has broader coverage
   * for newer drugs (like gene therapies) that may not have NDC listings yet.
   */
  async searchDrugs(
    tenantId: string,
    query: string,
    limit = DEFAULT_LIMIT,
  ): Promise<OpenFDADrugResult[]> {
    if (!(await this.isEnabled(tenantId))) return [];
    const q = (query || '').trim();
    if (q.length < 2) return [];

    const apiKey = await this.getApiKey(tenantId);
    const apiKeyParam = apiKey ? `&api_key=${apiKey}` : '';

    // Search both NDC directory and drug labels in parallel
    // OpenFDA: + means AND, , means OR — we want OR (brand OR generic name)
    const ndcSearchParam = `openfda.generic_name:"${q}",openfda.brand_name:"${q}"`;
    const ndcUrl = `${OPENFDA_BASE_URL}/drug/ndc.json?search=${encodeURIComponent(ndcSearchParam)}&limit=${limit}${apiKeyParam}`;
    const labelSearchParam = `openfda.brand_name:"${q}",openfda.generic_name:"${q}"`;
    const labelUrl = `${OPENFDA_BASE_URL}/drug/label.json?search=${encodeURIComponent(labelSearchParam)}&limit=${limit}${apiKeyParam}`;

    try {
      await this.respectRateLimit();
      const [ndcRes, labelRes] = await Promise.all([
        fetch(ndcUrl, { method: 'GET' }).catch((e) => { this.logger.warn(`NDC fetch failed: ${e.message}`); return null; }),
        fetch(labelUrl, { method: 'GET' }).catch((e) => { this.logger.warn(`Label fetch failed: ${e.message}`); return null; }),
      ]);

      const results: OpenFDADrugResult[] = [];

      // Parse NDC results
      if (ndcRes && ndcRes.ok) {
        const ndcData: any = await ndcRes.json();
        const ndcResults: any[] = ndcData?.results || [];
        for (const r of ndcResults) {
          results.push(this.parseNDCResult(r));
        }
      }

      // Parse label results (broader coverage — includes gene therapies)
      if (labelRes && labelRes.ok) {
        const labelData: any = await labelRes.json();
        const labelResults: any[] = labelData?.results || [];
        const seenNames = new Set(results.map((r) => r.name.toLowerCase()));
        for (const r of labelResults) {
          const parsed = this.parseLabelAsDrugResult(r);
          if (parsed && !seenNames.has(parsed.name.toLowerCase())) {
            seenNames.add(parsed.name.toLowerCase());
            results.push(parsed);
          }
        }
      }

      return results.slice(0, limit);
    } catch (err: any) {
      this.logger.warn(`OpenFDA drug search failed: ${err.message}`);
      return [];
    }
  }

  /**
   * Search for adverse event reports for a drug.
   * Data from FDA Adverse Event Reporting System (FAERS).
   */
  async searchAdverseEvents(
    tenantId: string,
    drugName: string,
    limit = DEFAULT_LIMIT,
  ): Promise<OpenFDAAdverseEvent[]> {
    if (!(await this.isEnabled(tenantId))) return [];
    const q = (drugName || '').trim();
    if (q.length < 2) return [];

    const apiKey = await this.getApiKey(tenantId);
    const url = `${OPENFDA_BASE_URL}/drug/event.json?search=patient.drug.openfda.brand_name:"${encodeURIComponent(q)}",patient.drug.openfda.generic_name:"${encodeURIComponent(q)}"&limit=${limit}${apiKey ? `&api_key=${apiKey}` : ''}`;

    try {
      await this.respectRateLimit();
      const res = await fetch(url, { method: 'GET' });
      if (!res.ok) {
        if (res.status === 404) return [];
        throw new Error(`OpenFA adverse event search returned ${res.status}`);
      }
      const data: any = await res.json();
      const results: any[] = data?.results || [];
      return results.map((r) => this.parseAdverseEvent(r));
    } catch (err: any) {
      this.logger.warn(`OpenFDA adverse event search failed: ${err.message}`);
      return [];
    }
  }

  /**
   * Search for drug recalls (enforcement reports).
   */
  async searchRecalls(
    tenantId: string,
    drugName: string,
    limit = DEFAULT_LIMIT,
  ): Promise<OpenFDARecall[]> {
    if (!(await this.isEnabled(tenantId))) return [];
    const q = (drugName || '').trim();
    if (q.length < 2) return [];

    const apiKey = await this.getApiKey(tenantId);
    const url = `${OPENFDA_BASE_URL}/drug/enforcement.json?search=product_description:"${encodeURIComponent(q)}"&limit=${limit}${apiKey ? `&api_key=${apiKey}` : ''}`;

    try {
      await this.respectRateLimit();
      const res = await fetch(url, { method: 'GET' });
      if (!res.ok) {
        if (res.status === 404) return [];
        throw new Error(`OpenFDA recall search returned ${res.status}`);
      }
      const data: any = await res.json();
      const results: any[] = data?.results || [];
      return results.map((r) => this.parseRecall(r));
    } catch (err: any) {
      this.logger.warn(`OpenFDA recall search failed: ${err.message}`);
      return [];
    }
  }

  /**
   * Get full drug label information (structured product label / SPL).
   * This includes indications, warnings, dosage, contraindications, etc.
   */
  async getDrugLabel(
    tenantId: string,
    drugName: string,
  ): Promise<OpenFDALabelInfo | null> {
    if (!(await this.isEnabled(tenantId))) return null;
    const q = (drugName || '').trim();
    if (q.length < 2) return null;

    const apiKey = await this.getApiKey(tenantId);
    const url = `${OPENFDA_BASE_URL}/drug/label.json?search=openfda.brand_name:"${encodeURIComponent(q)}",openfda.generic_name:"${encodeURIComponent(q)}"&limit=1${apiKey ? `&api_key=${apiKey}` : ''}`;

    try {
      await this.respectRateLimit();
      const res = await fetch(url, { method: 'GET' });
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error(`OpenFDA label search returned ${res.status}`);
      }
      const data: any = await res.json();
      const result = data?.results?.[0];
      if (!result) return null;
      return this.parseLabel(result);
    } catch (err: any) {
      this.logger.warn(`OpenFDA label search failed: ${err.message}`);
      return null;
    }
  }

  // ── Parsers ──────────────────────────────────────────────────────────────

  private parseNDCResult(r: any): OpenFDADrugResult {
    const openfda = r.openfda || {};
    return {
      id: r.id || openfda.package_ndc?.[0] || '',
      name: openfda.brand_name?.[0] || openfda.generic_name?.[0] || '',
      genericName: openfda.generic_name?.[0],
      brandName: openfda.brand_name?.[0],
      manufacturer: openfda.manufacturer_name?.[0],
      activeIngredients: openfda.active_ingredients?.map((ai: any) => ai.name) || [],
      strength: r.active_ingredients?.[0]?.strength || openfda.active_ingredients?.[0]?.strength,
      dosageForm: openfda.product_type?.[0] || r.product_type,
      route: openfda.route?.[0],
      ndc: openfda.package_ndc || [],
      rxNormCode: openfda.rxcui?.[0],
      deaSchedule: openfda.dea_schedule?.[0],
      productType: openfda.product_type?.[0],
      source: 'openfda',
    };
  }

  /** Parse a drug label result as a drug search result (for gene therapies and drugs not in NDC). */
  private parseLabelAsDrugResult(r: any): OpenFDADrugResult | null {
    const openfda = r.openfda || {};
    const name = openfda.brand_name?.[0] || openfda.generic_name?.[0] || '';
    if (!name) return null;
    return {
      id: r.id || openfda.package_ndc?.[0] || '',
      name,
      genericName: openfda.generic_name?.[0],
      brandName: openfda.brand_name?.[0],
      manufacturer: openfda.manufacturer_name?.[0],
      activeIngredients: (r.active_ingredient || []).map((ai: string) => ai.split('(')[0].trim()).filter(Boolean),
      dosageForm: openfda.product_type?.[0],
      route: openfda.route?.[0],
      ndc: openfda.package_ndc || [],
      rxNormCode: openfda.rxcui?.[0],
      deaSchedule: openfda.dea_schedule?.[0],
      productType: openfda.product_type?.[0],
      source: 'openfda',
    };
  }

  private parseAdverseEvent(r: any): OpenFDAAdverseEvent {
    const patient = r.patient || {};
    const drugs = patient.drug || [];
    const reactions = (patient.reaction || []).map((rx: any) => rx.reactionmeddrapt).filter(Boolean);
    const outcomes = (r.patient?.reaction || []).flatMap((rx: any) => rx.reactionoutcome || []).filter(Boolean);

    return {
      safetyReportId: r.safetyreportid || '',
      serious: r.serious === '1',
      patientAge: patient.patientonsetage ? `${patient.patientonsetage} ${patient.patientonsetageunit || ''}`.trim() : undefined,
      patientSex: patient.patientsex,
      reactions,
      outcomes,
      drugNames: drugs.map((d: any) => d.medicinalproduct).filter(Boolean),
      receivedDate: r.receivedate,
    };
  }

  private parseRecall(r: any): OpenFDARecall {
    return {
      recallNumber: r.recall_number || '',
      status: r.status || '',
      classification: r.classification || '',
      productDescription: r.product_description || '',
      reasonForRecall: r.reason_for_recall || '',
      recallingFirm: r.recalling_firm || '',
      distributionPattern: r.distribution_pattern,
      recallInitiationDate: r.recall_initiation_date,
      city: r.city,
      state: r.state,
      country: r.country,
    };
  }

  private parseLabel(r: any): OpenFDALabelInfo {
    const openfda = r.openfda || {};
    const getFirst = (arr?: string[]) => (arr && arr.length > 0 ? arr[0] : undefined);
    const getArray = (arr?: string[]) => arr || [];

    return {
      id: r.id || openfda.package_ndc?.[0] || '',
      brandName: getFirst(openfda.brand_name),
      genericName: getFirst(openfda.generic_name),
      manufacturer: getFirst(openfda.manufacturer_name),
      ndc: openfda.package_ndc || [],
      purpose: getFirst(r.purpose),
      indicationsAndUsage: getFirst(r.indications_and_usage),
      warnings: getFirst(r.warnings),
      dosageAndAdministration: getFirst(r.dosage_and_administration),
      contraindications: getFirst(r.contraindications),
      adverseReactions: getFirst(r.adverse_reactions),
      drugInteractions: getFirst(r.drug_interactions),
      pregnancyOrBreastFeeding: getFirst(r.pregnancy_or_breast_feeding),
      activeIngredients: (r.active_ingredient || []).map((ai: string) => ai),
      inactiveIngredients: getArray(r.inactive_ingredient),
      deaSchedule: getFirst(openfda.dea_schedule),
      productType: getFirst(openfda.product_type),
    };
  }

  // ── Rate limiting ──────────────────────────────────────────────────────────

  /** Simple rate limiter — ensures we don't exceed OpenFDA's free tier limits. */
  private async respectRateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - lastRequestTime;
    if (elapsed < RATE_LIMIT_DELAY_MS) {
      await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY_MS - elapsed));
    }
    lastRequestTime = Date.now();
  }
}
