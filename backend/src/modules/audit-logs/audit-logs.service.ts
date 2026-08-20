import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog, AuditAction } from './entities/audit-log.entity';

export interface AuditLogEntry {
  action: AuditAction;
  entityType: string;
  entityId: string;
  performedBy?: string | null;
  performedByName?: string | null;
  details?: Record<string, any> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  method?: string | null;
  url?: string | null;
  statusCode?: number | null;
  durationMs?: number | null;
  tenantId?: string | null;
}

export interface AuditLogQuery {
  page?: number;
  limit?: number;
  entityType?: string;
  action?: AuditAction;
  performedBy?: string;
  search?: string;
}

export interface PaginatedAuditLogs {
  data: AuditLog[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class AuditLogsService {
  private readonly logger = new Logger(AuditLogsService.name);

  constructor(
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
  ) {}

  async log(entry: AuditLogEntry): Promise<AuditLog> {
    const auditLog = this.auditLogRepository.create(entry);
    return this.auditLogRepository.save(auditLog);
  }

  /**
   * Fire-and-forget audit log — never throws, never blocks the caller.
   * Used by the AuditInterceptor so a failed audit write can't break a request.
   */
  logSafe(entry: AuditLogEntry): void {
    this.log(entry).catch((err) =>
      this.logger.error(`Failed to write audit log: ${err?.message || err}`),
    );
  }

  async findByEntity(entityType: string, entityId: string): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      where: { entityType, entityId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Paginated, tenant-scoped query for the admin audit-log dashboard.
   * Supports filtering by entityType, action, performedBy, and free-text
   * search over performedByName / entityType / url.
   */
  async findAll(
    tenantId: string,
    query: AuditLogQuery = {},
  ): Promise<PaginatedAuditLogs> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(200, Math.max(1, query.limit || 50));

    const qb = this.auditLogRepository.createQueryBuilder('log');
    qb.where('log.tenantId = :tenantId', { tenantId });

    if (query.entityType) qb.andWhere('log.entityType = :entityType', { entityType: query.entityType });
    if (query.action) qb.andWhere('log.action = :action', { action: query.action });
    if (query.performedBy) qb.andWhere('log.performedBy = :performedBy', { performedBy: query.performedBy });
    if (query.search) {
      qb.andWhere(
        '(log.performedByName ILIKE :search OR log.entityType ILIKE :search OR log.url ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    qb.orderBy('log.createdAt', 'DESC');
    qb.skip((page - 1) * limit);
    qb.take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }
}
