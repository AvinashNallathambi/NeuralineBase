import { api } from './api';

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'submit'
  | 'resubmit'
  | 'void'
  | 'corrected'
  | 'payment'
  | 'adjustment'
  | 'view';

export interface AuditLogEntry {
  id: string;
  tenantId: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  performedBy: string | null;
  performedByName: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  method: string | null;
  url: string | null;
  statusCode: number | null;
  durationMs: number | null;
  createdAt: string;
}

export interface PaginatedAuditLogs {
  data: AuditLogEntry[];
  total: number;
  page: number;
  limit: number;
}

export interface AuditLogQuery {
  page?: number;
  limit?: number;
  entityType?: string;
  action?: AuditAction;
  performedBy?: string;
  search?: string;
}

class AuditLogService {
  private baseUrl = '/audit-logs';

  async findAll(query: AuditLogQuery = {}): Promise<PaginatedAuditLogs> {
    const params = new URLSearchParams();
    if (query.page) params.append('page', String(query.page));
    if (query.limit) params.append('limit', String(query.limit));
    if (query.entityType) params.append('entityType', query.entityType);
    if (query.action) params.append('action', query.action);
    if (query.performedBy) params.append('performedBy', query.performedBy);
    if (query.search) params.append('search', query.search);
    const qs = params.toString();
    const response = await api.get(`${this.baseUrl}${qs ? `?${qs}` : ''}`);
    return response.data;
  }
}

export const auditLogService = new AuditLogService();
