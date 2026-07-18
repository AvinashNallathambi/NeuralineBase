import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import { IcdCode } from './entities/icd-code.entity';
import { FavoriteDiagnosis, DiagnosisCodingSystem } from './entities/favorite-diagnosis.entity';
import { PatientProblem, ProblemClinicalStatus } from '../patients/entities/patient-problem.entity';
import { Encounter } from '../clinical/entities/encounter.entity';
import { SearchIcdDto } from './dto/search-icd.dto';
import { UpdateIcdDto } from './dto/update-icd.dto';
import { UnifiedSearchDto } from './dto/unified-search.dto';
import { CreateFavoriteDiagnosisDto } from './dto/create-favorite-diagnosis.dto';

export interface IcdSearchResult {
  data: IcdCode[];
  total: number;
  query: string;
}

export interface UnifiedSearchResult {
  query: string;
  patientActiveProblems: PatientProblem[];
  favoriteDiagnoses: FavoriteDiagnosis[];
  icd10Results: IcdCode[];
  recentDiagnoses: Array<{ code: string; codeSystem: string; description: string; encounterDate: Date | null }>;
}

@Injectable()
export class IcdCodeService {
  private readonly logger = new Logger(IcdCodeService.name);

  constructor(
    @InjectRepository(IcdCode)
    private readonly repository: Repository<IcdCode>,
    @InjectRepository(FavoriteDiagnosis)
    private readonly favoriteRepository: Repository<FavoriteDiagnosis>,
    @InjectRepository(PatientProblem)
    private readonly problemRepository: Repository<PatientProblem>,
    @InjectRepository(Encounter)
    private readonly encounterRepository: Repository<Encounter>,
  ) {}

  async search(dto: SearchIcdDto): Promise<IcdSearchResult> {
    const { q, limit = 25, offset = 0 } = dto;
    const query = q.trim();

    if (!query) {
      const [data, total] = await this.repository.findAndCount({ take: limit, skip: offset, order: { code: 'ASC' } });
      return { data, total, query };
    }

    const cleanQuery = query.replace(/[^\w\s.-]/g, '').trim();
    const qb = this.repository.createQueryBuilder('c');

    qb.where(
      new Brackets((sub) => {
        sub.where('c.code ILIKE :codeSearch', { codeSearch: `%${cleanQuery}%` });
        sub.orWhere('c.description ILIKE :descSearch', { descSearch: `%${cleanQuery}%` });
      }),
    );

    qb.andWhere('c.is_header = false');

    qb.orderBy(
      `CASE
        WHEN c.code ILIKE :exactOrder THEN 0
        WHEN c.code ILIKE :prefixOrder THEN 1
        WHEN c.description ILIKE :descExact THEN 2
        ELSE 3
      END`,
      'ASC',
    );

    qb.setParameters({
      exactOrder: `${cleanQuery}%`,
      prefixOrder: `${cleanQuery}%`,
      descExact: `%${cleanQuery}%`,
    });

    qb.addOrderBy('LENGTH(c.code)', 'ASC');
    qb.addOrderBy('c.code', 'ASC');

    const [data, total] = await qb
      .take(Math.min(limit, 100))
      .skip(offset)
      .getManyAndCount();

    return { data, total, query };
  }

  async unifiedSearch(tenantId: string, dto: UnifiedSearchDto): Promise<UnifiedSearchResult> {
    const { q, patientId, providerId, limit = 25 } = dto;
    const query = q.trim();
    const search = `%${query}%`;
    const capLimit = Math.min(limit, 100);

    const patientActiveProblems = await this.findPatientActiveProblems(patientId, query, search, capLimit);
    const favoriteDiagnoses = await this.findFavoriteDiagnoses(tenantId, providerId, query, search, capLimit);
    const icd10Results = (await this.search({ q: query, limit: capLimit })).data;
    const recentDiagnoses = await this.findRecentDiagnoses(tenantId, patientId, query, capLimit);

    return {
      query,
      patientActiveProblems,
      favoriteDiagnoses,
      icd10Results,
      recentDiagnoses,
    };
  }

  private async findPatientActiveProblems(
    patientId: string | undefined,
    query: string,
    search: string,
    limit: number,
  ): Promise<PatientProblem[]> {
    if (!patientId) return [];

    const qb = this.problemRepository
      .createQueryBuilder('p')
      .where('p.patientId = :patientId', { patientId })
      .andWhere('p.clinicalStatus = :active', { active: ProblemClinicalStatus.ACTIVE })
      .andWhere('p.deletedAt IS NULL')
      .andWhere(
        new Brackets((sub) => {
          sub.where('p.code ILIKE :search', { search });
          sub.orWhere('p.description ILIKE :search', { search });
        }),
      )
      .orderBy(
        `CASE
          WHEN p.code ILIKE :exact THEN 0
          WHEN p.description ILIKE :exact THEN 1
          ELSE 2
        END`,
        'ASC',
      )
      .setParameter('exact', `${query}%`)
      .take(limit);

    return qb.getMany();
  }

  private async findFavoriteDiagnoses(
    tenantId: string,
    providerId: string | undefined,
    query: string,
    search: string,
    limit: number,
  ): Promise<FavoriteDiagnosis[]> {
    const qb = this.favoriteRepository
      .createQueryBuilder('f')
      .where('f.tenantId = :tenantId', { tenantId })
      .andWhere('f.deletedAt IS NULL')
      .andWhere(
        new Brackets((sub) => {
          sub.where('f.code ILIKE :search', { search });
          sub.orWhere('f.description ILIKE :search', { search });
        }),
      );

    // Only filter by providerId if it's a valid UUID — the favorite_diagnoses
    // table stores provider_id as a uuid column, so passing a non-UUID string
    // (e.g. dev seed IDs like "usr-001") would cause a Postgres syntax error.
    if (providerId && this.isValidUuid(providerId)) {
      qb.andWhere(
        new Brackets((sub) => {
          sub.where('f.providerId = :providerId', { providerId });
          sub.orWhere('f.providerId IS NULL');
        }),
      );
    }

    qb.orderBy(
      `CASE
        WHEN f.code ILIKE :exact THEN 0
        WHEN f.description ILIKE :exact THEN 1
        ELSE 2
      END`,
      'ASC',
    )
      .setParameter('exact', `${query}%`)
      .take(limit);

    return qb.getMany();
  }

  private async findRecentDiagnoses(
    tenantId: string,
    patientId: string | undefined,
    query: string,
    limit: number,
  ): Promise<Array<{ code: string; codeSystem: string; description: string; encounterDate: Date | null }>> {
    const qb = this.encounterRepository
      .createQueryBuilder('e')
      .where('e.tenantId = :tenantId', { tenantId })
      .andWhere('e.diagnoses IS NOT NULL')
      .andWhere("e.diagnoses::text != '[]'")
      .orderBy('e.startTime', 'DESC')
      .take(50);

    if (patientId) {
      qb.andWhere('e.patientId = :patientId', { patientId });
    }

    const encounters = await qb.getMany();
    const seen = new Set<string>();
    const results: Array<{ code: string; codeSystem: string; description: string; encounterDate: Date | null }> = [];
    const queryLower = query.toLowerCase();

    for (const encounter of encounters) {
      for (const dx of encounter.diagnoses || []) {
        const key = `${dx.code}|${dx.description}`.toLowerCase();
        if (seen.has(key)) continue;

        const matches =
          dx.code.toLowerCase().includes(queryLower) ||
          dx.description.toLowerCase().includes(queryLower);

        if (!matches) continue;

        seen.add(key);
        results.push({
          code: dx.code,
          codeSystem: dx.codeSystem || 'ICD-10-CM',
          description: dx.description,
          encounterDate: encounter.startTime,
        });

        if (results.length >= limit) return results;
      }
    }

    return results;
  }

  async findFavorites(tenantId: string, providerId?: string): Promise<FavoriteDiagnosis[]> {
    const qb = this.favoriteRepository
      .createQueryBuilder('f')
      .where('f.tenantId = :tenantId', { tenantId })
      .andWhere('f.deletedAt IS NULL')
      .orderBy('f.createdAt', 'DESC');

    if (providerId && this.isValidUuid(providerId)) {
      qb.andWhere(
        new Brackets((sub) => {
          sub.where('f.providerId = :providerId', { providerId });
          sub.orWhere('f.providerId IS NULL');
        }),
      );
    }

    return qb.getMany();
  }

  async createFavorite(tenantId: string, dto: CreateFavoriteDiagnosisDto, providerId?: string): Promise<FavoriteDiagnosis> {
    const favorite = new FavoriteDiagnosis();
    favorite.tenantId = tenantId;
    favorite.providerId = providerId || null;
    favorite.code = dto.code.toUpperCase().trim();
    favorite.codeSystem = dto.codeSystem || DiagnosisCodingSystem.ICD_10_CM;
    favorite.description = dto.description.trim();
    favorite.isBillable = dto.isBillable ?? false;
    const saved = await this.favoriteRepository.save(favorite);
    this.logger.log(`Favorite diagnosis created: ${saved.id}`);
    return saved;
  }

  async removeFavorite(tenantId: string, id: string, providerId?: string): Promise<void> {
    const where: Record<string, unknown> = { id, tenantId };
    if (providerId) {
      where['providerId'] = providerId;
    }
    const favorite = await this.favoriteRepository.findOne({ where });
    if (!favorite) throw new NotFoundException(`Favorite diagnosis "${id}" not found`);
    await this.favoriteRepository.softRemove(favorite);
    this.logger.log(`Favorite diagnosis removed: ${id}`);
  }

  async findByCode(code: string): Promise<IcdCode | null> {
    return this.repository.findOne({ where: { code: code.toUpperCase().trim() } });
  }

  async findById(id: string): Promise<IcdCode> {
    const code = await this.repository.findOne({ where: { id } });
    if (!code) throw new NotFoundException(`ICD-10 code "${id}" not found`);
    return code;
  }

  async update(id: string, dto: UpdateIcdDto): Promise<IcdCode> {
    const code = await this.findById(id);
    Object.assign(code, dto);
    return this.repository.save(code);
  }

  async count(): Promise<number> {
    return this.repository.count();
  }

  async refreshSearchVectors(): Promise<number> {
    await this.repository.query(
      `ALTER TABLE icd_codes ADD COLUMN IF NOT EXISTS search_vector tsvector`,
    );
    await this.repository.query(
      `UPDATE icd_codes SET search_vector = to_tsvector('english',
        coalesce(code, '') || ' ' || coalesce(description, '') || ' ' ||
        coalesce(category, '') || ' ' || coalesce(chapter_title, '')
      )`,
    );
    const result = await this.repository.query(`SELECT COUNT(*) as cnt FROM icd_codes WHERE search_vector IS NOT NULL`);
    const count = parseInt(result?.[0]?.cnt ?? '0', 10);
    this.logger.log(`Updated search vectors for ${count} rows`);
    return count;
  }

  async deleteAll(): Promise<void> {
    await this.repository.query('TRUNCATE TABLE icd_codes RESTART IDENTITY CASCADE');
    this.logger.log('All ICD-10 codes deleted');
  }

  /** Quick UUID format check to avoid Postgres "invalid input syntax for type uuid" errors. */
  private isValidUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  }
}
