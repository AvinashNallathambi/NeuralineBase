import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HipaaAuditLog } from '../entities/hipaa-audit-log.entity';
import { EncryptionService } from './encryption.service';

export interface AuditEntry {
  tenantId?: string | null;
  userId?: string | null;
  userEmail?: string | null;
  userRole?: string | null;
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  description?: string | null;
  httpMethod?: string | null;
  endpoint?: string | null;
  statusCode?: number | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  correlationId?: string | null;
  durationMs?: number | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * HIPAA Audit Logging Service
 *
 * Provides an immutable, append-only audit trail for all PHI access
 * as required by 45 CFR 164.312(b).
 *
 * - Emails are hashed (never stored in clear text in the audit log)
 * - Entries are write-once; no update/delete methods are exposed
 * - Logs are retained for a minimum of 6 years per HIPAA
 */
@Injectable()
export class HipaaAuditService {
  private readonly logger = new Logger(HipaaAuditService.name);

  constructor(
    @InjectRepository(HipaaAuditLog)
    private readonly auditRepo: Repository<HipaaAuditLog>,
    private readonly encryptionService: EncryptionService,
  ) {}

  /** Write an immutable audit record. */
  async log(entry: AuditEntry): Promise<void> {
    try {
      const record = this.auditRepo.create({
        tenantId: entry.tenantId ?? null,
        userId: entry.userId ?? null,
        userEmailHash: entry.userEmail
          ? this.encryptionService.hash(entry.userEmail)
          : null,
        userRole: entry.userRole ?? null,
        action: entry.action,
        resourceType: entry.resourceType ?? null,
        resourceId: entry.resourceId ?? null,
        description: entry.description ?? null,
        httpMethod: entry.httpMethod ?? null,
        endpoint: this.sanitizeEndpoint(entry.endpoint),
        statusCode: entry.statusCode ?? null,
        ipAddress: entry.ipAddress ?? null,
        userAgent: entry.userAgent?.substring(0, 500) ?? null,
        correlationId: entry.correlationId ?? null,
        durationMs: entry.durationMs ?? null,
        metadata: entry.metadata ?? null,
      });

      await this.auditRepo.save(record);
    } catch (error) {
      // Audit logging must never crash the application, but we still want
      // visibility into failures.
      this.logger.error(`Failed to write audit log: ${error}`);
    }
  }

  /** Convenience: log a PHI access event. */
  async logPhiAccess(
    userId: string,
    userEmail: string,
    userRole: string,
    tenantId: string,
    resourceType: string,
    resourceId: string,
    action: 'READ' | 'CREATE' | 'UPDATE' | 'DELETE' | 'EXPORT',
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.log({
      userId,
      userEmail,
      userRole,
      tenantId,
      resourceType,
      resourceId,
      action,
      description: `${action} ${resourceType} ${resourceId}`,
      metadata,
    });
  }

  /** Convenience: log an authentication event. */
  async logAuthEvent(
    action: 'LOGIN' | 'LOGOUT' | 'FAILED_LOGIN' | 'MFA_VERIFY' | 'PASSWORD_CHANGE',
    ipAddress: string,
    userAgent: string,
    userId?: string,
    userEmail?: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.log({
      userId,
      userEmail,
      action,
      ipAddress,
      userAgent,
      description: `${action} attempt`,
      metadata,
    });
  }

  /** Strip query parameters (may contain PHI) from URLs. */
  private sanitizeEndpoint(url?: string | null): string | null {
    if (!url) return null;
    const idx = url.indexOf('?');
    return idx >= 0 ? url.substring(0, idx) : url;
  }
}
