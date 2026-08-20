import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request } from 'express';
import { AuditLogsService } from '../../modules/audit-logs/audit-logs.service';
import { AuditAction } from '../../modules/audit-logs/entities/audit-log.entity';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    tenantId: string;
    role: string;
  };
}

// HIPAA: Fields that must never appear in logs
const PHI_FIELDS = [
  'email', 'ssn', 'dateOfBirth', 'dob', 'phone', 'address',
  'insuranceId', 'mrn', 'medicalRecordNumber', 'diagnosis',
];

/** Strip query params and mask PHI from URL for safe logging. */
function sanitizeUrl(url: string): string {
  const idx = url.indexOf('?');
  const clean = idx >= 0 ? url.substring(0, idx) : url;
  // Truncate to entity column max length
  return clean.length > 500 ? clean.substring(0, 500) : clean;
}

/** Map HTTP method → AuditAction enum. */
function methodToAction(method: string): AuditAction {
  switch (method.toUpperCase()) {
    case 'POST':
      return AuditAction.CREATE;
    case 'PUT':
    case 'PATCH':
      return AuditAction.UPDATE;
    case 'DELETE':
      return AuditAction.DELETE;
    default:
      return AuditAction.VIEW;
  }
}

/** Skip paths that would create excessive noise or recursion. */
function shouldSkip(url: string): boolean {
  const clean = sanitizeUrl(url);
  return (
    clean.startsWith('/api/v1/health') ||
    clean.startsWith('/api/v1/audit-logs') ||
    clean.startsWith('/swagger') ||
    clean.startsWith('/api-json') ||
    clean === '/' ||
    clean.startsWith('/favicon')
  );
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger('AuditLog');

  constructor(private readonly auditLogsService: AuditLogsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const { method, url, ip, headers } = request;
    const user = request.user;
    const userAgent = (headers['user-agent'] || 'unknown') as string;
    const startTime = Date.now();
    const handler = context.getHandler().name;
    const controller = context.getClass().name;

    // Skip noisy / recursive paths
    if (shouldSkip(url)) {
      return next.handle();
    }

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse();
          const statusCode = response.statusCode;
          const duration = Date.now() - startTime;
          const safeUrl = sanitizeUrl(url);

          // Console log (HIPAA-compliant structured JSON)
          this.logger.log(
            JSON.stringify({
              timestamp: new Date().toISOString(),
              userId: user?.id || 'anonymous',
              // HIPAA: Never log email in plaintext
              tenantId: user?.tenantId || 'none',
              role: user?.role || 'none',
              action: `${controller}.${handler}`,
              method,
              url: safeUrl,
              statusCode,
              duration: `${duration}ms`,
              ip,
              userAgent,
            }),
          );

          // Persist to audit_logs table (fire-and-forget)
          this.auditLogsService.logSafe({
            action: methodToAction(method),
            entityType: controller,
            entityId: `${method}:${safeUrl}`,
            performedBy: user?.id || null,
            performedByName: user?.email || 'anonymous',
            tenantId: user?.tenantId || null,
            ipAddress: ip || null,
            userAgent: userAgent.length > 500 ? userAgent.substring(0, 500) : userAgent,
            method,
            url: safeUrl,
            statusCode,
            durationMs: duration,
            details: { handler, role: user?.role || null },
          });
        },
        error: (error: Error) => {
          const duration = Date.now() - startTime;
          const safeUrl = sanitizeUrl(url);

          this.logger.warn(
            JSON.stringify({
              timestamp: new Date().toISOString(),
              userId: user?.id || 'anonymous',
              // HIPAA: Never log email in plaintext
              tenantId: user?.tenantId || 'none',
              role: user?.role || 'none',
              action: `${controller}.${handler}`,
              method,
              url: safeUrl,
              statusCode: 'ERROR',
              error: this.sanitizeErrorMessage(error.message),
              duration: `${duration}ms`,
              ip,
              userAgent,
            }),
          );

          // Persist failed requests too (useful for security forensics)
          this.auditLogsService.logSafe({
            action: methodToAction(method),
            entityType: controller,
            entityId: `${method}:${safeUrl}`,
            performedBy: user?.id || null,
            performedByName: user?.email || 'anonymous',
            tenantId: user?.tenantId || null,
            ipAddress: ip || null,
            userAgent: userAgent.length > 500 ? userAgent.substring(0, 500) : userAgent,
            method,
            url: safeUrl,
            statusCode: 500,
            durationMs: duration,
            details: {
              handler,
              role: user?.role || null,
              error: this.sanitizeErrorMessage(error.message),
            },
          });
        },
      }),
    );
  }

  /** Remove potential PHI from error messages before logging. */
  private sanitizeErrorMessage(message: string): string {
    let sanitized = message;
    // Mask email-like patterns
    sanitized = sanitized.replace(
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
      '[REDACTED_EMAIL]',
    );
    // Mask SSN-like patterns
    sanitized = sanitized.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED_SSN]');
    // Mask phone-like patterns
    sanitized = sanitized.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[REDACTED_PHONE]');
    return sanitized;
  }
}
