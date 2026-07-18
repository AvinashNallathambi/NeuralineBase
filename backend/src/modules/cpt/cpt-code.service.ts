import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import { CptCode } from './entities/cpt-code.entity';
import { SearchCptDto } from './dto/search-cpt.dto';

export interface CptSearchResult {
  data: CptCode[];
  total: number;
  query: string;
}

@Injectable()
export class CptCodeService {
  private readonly logger = new Logger(CptCodeService.name);

  constructor(
    @InjectRepository(CptCode)
    private readonly repository: Repository<CptCode>,
  ) {}

  async search(dto: SearchCptDto): Promise<CptSearchResult> {
    const { q, limit = 25, offset = 0 } = dto;
    const query = q.trim();

    if (!query) {
      const [data, total] = await this.repository.findAndCount({
        where: { isActive: true },
        take: limit,
        skip: offset,
        order: { code: 'ASC' },
      });
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

    qb.andWhere('c.is_active = true');

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

  async findByCode(code: string): Promise<CptCode | null> {
    return this.repository.findOne({
      where: { code: code.toUpperCase().trim() },
    });
  }

  async findById(id: string): Promise<CptCode> {
    const code = await this.repository.findOne({ where: { id } });
    if (!code) throw new NotFoundException(`CPT code "${id}" not found`);
    return code;
  }

  async count(): Promise<number> {
    return this.repository.count();
  }
}
