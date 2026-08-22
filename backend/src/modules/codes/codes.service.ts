import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import { IcdCode } from '../icd/entities/icd-code.entity';
import { CptCode } from '../cpt/entities/cpt-code.entity';
import { PatientProblem, ProblemClinicalStatus } from '../patients/entities/patient-problem.entity';
import { FavoriteDiagnosis } from '../icd/entities/favorite-diagnosis.entity';
import { Encounter } from '../clinical/entities/encounter.entity';
import { SearchCodesDto } from './dto/search-codes.dto';

export type CodeSystemType =
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

const ALL_TYPES: CodeSystemType[] = [
  'ICD-10-CM',
  'ICD-9-CM',
  'SNOMED CT',
  'ICD-11',
  'CPT',
  'HCPCS',
  'LOINC',
  'CUSTOM',
];

@Injectable()
export class CodesService {
  private readonly logger = new Logger(CodesService.name);

  constructor(
    @InjectRepository(IcdCode)
    private readonly icdRepository: Repository<IcdCode>,
    @InjectRepository(CptCode)
    private readonly cptRepository: Repository<CptCode>,
    @InjectRepository(PatientProblem)
    private readonly problemRepository: Repository<PatientProblem>,
    @InjectRepository(FavoriteDiagnosis)
    private readonly favoriteRepository: Repository<FavoriteDiagnosis>,
    @InjectRepository(Encounter)
    private readonly encounterRepository: Repository<Encounter>,
  ) {}

  async search(tenantId: string, dto: SearchCodesDto): Promise<UnifiedCodeSearchResult> {
    const query = dto.q.trim();
    const capLimit = Math.min(dto.limit ?? 25, 100);
    const requestedTypes = dto.types
      ? (dto.types.split(',').map((t) => t.trim().toUpperCase()) as string[])
      : ALL_TYPES.map((t) => t as string);

    const search = `%${query}%`;
    const results: UnifiedCodeResult[] = [];
    const grouped: Record<string, UnifiedCodeResult[]> = {};

    const addToResults = (system: string, items: UnifiedCodeResult[]) => {
      if (items.length === 0) return;
      grouped[system] = items;
      results.push(...items);
    };

    // Search ICD-10
    if (requestedTypes.includes('ICD-10-CM')) {
      const icdResults = await this.searchIcd10(query, search, capLimit);
      addToResults('ICD-10-CM', icdResults);
    }

    // Search CPT + HCPCS
    if (requestedTypes.includes('CPT') || requestedTypes.includes('HCPCS')) {
      const cptResults = await this.searchCpt(query, search, capLimit, requestedTypes);
      if (cptResults.cpt.length > 0) addToResults('CPT', cptResults.cpt);
      if (cptResults.hcpcs.length > 0) addToResults('HCPCS', cptResults.hcpcs);
    }

    // Search patient active problems (SNOMED, ICD-11, ICD-9, ICD-10)
    if (requestedTypes.some((t) => ['SNOMED CT', 'ICD-11', 'ICD-9-CM', 'ICD-10-CM'].includes(t))) {
      const problemResults = await this.searchPatientProblems(query, search, capLimit, requestedTypes);
      if (problemResults.length > 0) addToResults('Patient Problems', problemResults);
    }

    // Search favorites
    if (requestedTypes.some((t) => ['SNOMED CT', 'ICD-11', 'ICD-9-CM', 'ICD-10-CM'].includes(t))) {
      const favResults = await this.searchFavorites(tenantId, query, search, capLimit, requestedTypes);
      if (favResults.length > 0) addToResults('Favorites', favResults);
    }

    // Search recent encounter diagnoses
    if (requestedTypes.some((t) => ['SNOMED CT', 'ICD-11', 'ICD-9-CM', 'ICD-10-CM'].includes(t))) {
      const recentResults = await this.searchRecentDiagnoses(tenantId, query, capLimit, requestedTypes);
      if (recentResults.length > 0) addToResults('Recent', recentResults);
    }

    return { query, results, grouped };
  }

  private async searchIcd10(query: string, search: string, limit: number): Promise<UnifiedCodeResult[]> {
    const cleanQuery = query.replace(/[^\w\s.-]/g, '').trim();
    const qb = this.icdRepository.createQueryBuilder('c');
    qb.where(
      new Brackets((sub) => {
        sub.where('c.code ILIKE :codeSearch', { codeSearch: `%${cleanQuery}%` });
        sub.orWhere('c.description ILIKE :descSearch', { descSearch: `%${cleanQuery}%` });
      }),
    );
    qb.andWhere('c.is_header = false');
    qb.orderBy('LENGTH(c.code)', 'ASC').addOrderBy('c.code', 'ASC').take(limit);

    const data = await qb.getMany();
    return data.map((c) => ({
      code: c.code,
      description: c.description,
      codeSystem: 'ICD-10-CM',
      category: c.category,
      isBillable: c.isBillable,
      isProcedure: false,
    }));
  }

  private async searchCpt(
    query: string,
    search: string,
    limit: number,
    requestedTypes: string[],
  ): Promise<{ cpt: UnifiedCodeResult[]; hcpcs: UnifiedCodeResult[] }> {
    const cleanQuery = query.replace(/[^\w\s.-]/g, '').trim();
    const qb = this.cptRepository.createQueryBuilder('c');
    qb.where(
      new Brackets((sub) => {
        sub.where('c.code ILIKE :codeSearch', { codeSearch: `%${cleanQuery}%` });
        sub.orWhere('c.description ILIKE :descSearch', { descSearch: `%${cleanQuery}%` });
      }),
    );
    qb.andWhere('c.is_active = true');
    qb.orderBy('LENGTH(c.code)', 'ASC').addOrderBy('c.code', 'ASC').take(limit);

    const data = await qb.getMany();
    const cpt: UnifiedCodeResult[] = [];
    const hcpcs: UnifiedCodeResult[] = [];

    for (const c of data) {
      const item: UnifiedCodeResult = {
        code: c.code,
        description: c.description,
        codeSystem: c.category === 'HCPCS' ? 'HCPCS' : 'CPT',
        category: c.category,
        isProcedure: true,
      };
      if (c.category === 'HCPCS') {
        if (requestedTypes.includes('HCPCS')) hcpcs.push(item);
      } else {
        if (requestedTypes.includes('CPT')) cpt.push(item);
      }
    }

    return { cpt, hcpcs };
  }

  private async searchPatientProblems(
    query: string,
    search: string,
    limit: number,
    requestedTypes: string[],
  ): Promise<UnifiedCodeResult[]> {
    const qb = this.problemRepository
      .createQueryBuilder('p')
      .where('p.clinicalStatus = :active', { active: ProblemClinicalStatus.ACTIVE })
      .andWhere('p.deletedAt IS NULL')
      .andWhere(
        new Brackets((sub) => {
          sub.where('p.code ILIKE :search', { search });
          sub.orWhere('p.description ILIKE :search', { search });
        }),
      )
      .take(limit);

    const data = await qb.getMany();
    const seen = new Set<string>();
    const results: UnifiedCodeResult[] = [];

    for (const p of data) {
      const system = p.codeSystem || 'ICD-10-CM';
      if (!requestedTypes.includes(system)) continue;
      const key = `${system}|${p.code}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({
        code: p.code,
        description: p.description,
        codeSystem: system,
        isBillable: system === 'ICD-10-CM',
        isProcedure: false,
      });
    }

    return results;
  }

  private async searchFavorites(
    tenantId: string,
    query: string,
    search: string,
    limit: number,
    requestedTypes: string[],
  ): Promise<UnifiedCodeResult[]> {
    const qb = this.favoriteRepository
      .createQueryBuilder('f')
      .where('f.tenantId = :tenantId', { tenantId })
      .andWhere('f.deletedAt IS NULL')
      .andWhere(
        new Brackets((sub) => {
          sub.where('f.code ILIKE :search', { search });
          sub.orWhere('f.description ILIKE :search', { search });
        }),
      )
      .take(limit);

    const data = await qb.getMany();
    const seen = new Set<string>();
    const results: UnifiedCodeResult[] = [];

    for (const f of data) {
      const system = f.codeSystem || 'ICD-10-CM';
      if (!requestedTypes.includes(system)) continue;
      const key = `${system}|${f.code}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({
        code: f.code,
        description: f.description,
        codeSystem: system,
        isBillable: f.isBillable,
        isProcedure: false,
      });
    }

    return results;
  }

  private async searchRecentDiagnoses(
    tenantId: string,
    query: string,
    limit: number,
    requestedTypes: string[],
  ): Promise<UnifiedCodeResult[]> {
    const qb = this.encounterRepository
      .createQueryBuilder('e')
      .where('e.tenantId = :tenantId', { tenantId })
      .andWhere('e.diagnoses IS NOT NULL')
      .andWhere("e.diagnoses::text != '[]'")
      .orderBy('e.startTime', 'DESC')
      .take(50);

    const encounters = await qb.getMany();
    const seen = new Set<string>();
    const results: UnifiedCodeResult[] = [];
    const queryLower = query.toLowerCase();

    for (const encounter of encounters) {
      for (const dx of encounter.diagnoses || []) {
        const system = dx.codeSystem || 'ICD-10-CM';
        if (!requestedTypes.includes(system)) continue;
        const key = `${system}|${dx.code}`;
        if (seen.has(key)) continue;

        const matches =
          dx.code.toLowerCase().includes(queryLower) ||
          dx.description.toLowerCase().includes(queryLower);

        if (!matches) continue;

        seen.add(key);
        results.push({
          code: dx.code,
          description: dx.description,
          codeSystem: system,
          isProcedure: false,
        });

        if (results.length >= limit) return results;
      }
    }

    return results;
  }
}
