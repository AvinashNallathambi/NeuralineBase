import { Injectable, Logger } from '@nestjs/common';
import { IntegrationsService } from '../integrations/integrations.service';

/**
 * DailyMed provides full FDA-approved prescribing information (SPL labels)
 * for all FDA-regulated drugs, including gene therapies and biologics.
 *
 * API docs: https://dailymed.nlm.nih.gov/dailymed/app-support-web-services.cfm
 * No API key required. Free.
 */
export interface DailyMedSearchResult {
  title: string;
  splVersion: string;
  publishedDate: string;
  id: string;
  url: string;
}

export interface DailyMedLabelInfo {
  title: string;
  setId: string;
  versionNumber: string;
  publishedDate: string;
  effectiveTime: string;
  /** Raw label sections as key-value pairs (section code → text). */
  sections: { title: string; text: string }[];
  activeIngredients: string[];
  inactiveIngredients: string[];
  ndc: string[];
  rxNormCode?: string;
}

const DAILYMED_BASE_URL = 'https://dailymed.nlm.nih.gov/dailymed/services/v2';

@Injectable()
export class DailyMedService {
  private readonly logger = new Logger(DailyMedService.name);

  constructor(private readonly integrationsService: IntegrationsService) {}

  async isEnabled(tenantId: string): Promise<boolean> {
    return this.integrationsService.isEnabled(tenantId, 'dailymed');
  }

  /**
   * Search DailyMed for drug labels by name.
   * Returns structured product label (SPL) metadata.
   */
  async searchLabels(
    tenantId: string,
    query: string,
    limit = 25,
  ): Promise<DailyMedSearchResult[]> {
    if (!(await this.isEnabled(tenantId))) return [];
    const q = (query || '').trim();
    if (q.length < 2) return [];

    const url = `${DAILYMED_BASE_URL}/spls.json?drug_name=${encodeURIComponent(q)}&pagesize=${limit}&page=1`;

    try {
      const res = await fetch(url, { method: 'GET' });
      if (!res.ok) {
        if (res.status === 404) return [];
        throw new Error(`DailyMed search returned ${res.status}`);
      }
      const data: any = await res.json();
      const results: any[] = data?.data || [];
      return results.map((r) => ({
        title: r.title || '',
        splVersion: r.spl_version || '',
        publishedDate: r.published_date || '',
        id: r.id || '',
        url: r.url || '',
      }));
    } catch (err: any) {
      this.logger.warn(`DailyMed search failed: ${err.message}`);
      return [];
    }
  }

  /**
   * Get full label details for a specific SPL set ID.
   * Returns structured sections (indications, warnings, dosage, etc.)
   */
  async getLabelDetails(
    tenantId: string,
    setId: string,
  ): Promise<DailyMedLabelInfo | null> {
    if (!(await this.isEnabled(tenantId))) return null;
    if (!setId) return null;

    const url = `${DAILYMED_BASE_URL}/spls/${encodeURIComponent(setId)}.json`;

    try {
      const res = await fetch(url, { method: 'GET' });
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error(`DailyMed label details returned ${res.status}`);
      }
      const data: any = await res.json();
      const spl = data?.data?.[0];
      if (!spl) return null;

      const sections: { title: string; text: string }[] = [];
      const activeIngredients: string[] = [];
      const inactiveIngredients: string[] = [];
      const ndc: string[] = [];
      let rxNormCode: string | undefined;

      // Parse SPL sections
      const splSections = spl.sections || [];
      for (const section of splSections) {
        const title = section.title || '';
        const text = (section.text || '').replace(/<[^>]*>/g, '').trim();
        if (title && text) {
          sections.push({ title, text });
        }
      }

      // Parse active ingredients
      const products = spl.products || [];
      for (const product of products) {
        const ingredients = product.active_ingredient || [];
        for (const ing of ingredients) {
          if (ing.name) activeIngredients.push(ing.name);
        }
        const inactive = product.inactive_ingredient || [];
        for (const ing of inactive) {
          if (ing.name) inactiveIngredients.push(ing.name);
        }
        if (product.ndc) ndc.push(product.ndc);
        if (product.rxcui && !rxNormCode) rxNormCode = product.rxcui;
      }

      return {
        title: spl.title || '',
        setId: spl.setid || setId,
        versionNumber: spl.spl_version || '',
        publishedDate: spl.published_date || '',
        effectiveTime: spl.effective_time || '',
        sections,
        activeIngredients,
        inactiveIngredients,
        ndc,
        rxNormCode,
      };
    } catch (err: any) {
      this.logger.warn(`DailyMed label details failed: ${err.message}`);
      return null;
    }
  }
}
