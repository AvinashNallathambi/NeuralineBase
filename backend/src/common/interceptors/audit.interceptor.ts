import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request } from 'express';

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
  return idx >= 0 ? url.substring(0, idx) : url;
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger('AuditLog');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const { method, url, ip, headers } = request;
    const user = request.user;
    const userAgent = headers['user-agent'] || 'unknown';
    const startTime = Date.now();
    const handler = context.getHandler().name;
    const controller = context.getClass().name;

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse();
          const statusCode = response.statusCode;
          const duration = Date.now() - startTime;

          this.logger.log(
            JSON.stringify({
              timestamp: new Date().toISOString(),
              userId: user?.id || 'anonymous',
              // HIPAA: Never log email in plaintext
              tenantId: user?.tenantId || 'none',
              role: user?.role || 'none',
              action: `${controller}.${handler}`,
              method,
              url: sanitizeUrl(url),
              statusCode,
              duration: `${duration}ms`,
              ip,
              userAgent,
            }),
          );
        },
        error: (error: Error) => {
          const duration = Date.now() - startTime;

          this.logger.warn(
            JSON.stringify({
              timestamp: new Date().toISOString(),
              userId: user?.id || 'anonymous',
              // HIPAA: Never log email in plaintext
              tenantId: user?.tenantId || 'none',
              role: user?.role || 'none',
              action: `${controller}.${handler}`,
              method,
              url: sanitizeUrl(url),
              statusCode: 'ERROR',
              error: this.sanitizeErrorMessage(error.message),
              duration: `${duration}ms`,
              ip,
              userAgent,
            }),
          );
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
