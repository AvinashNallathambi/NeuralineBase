import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  UnauthorizedException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    tenantId: string;
    role: string;
  };
  tenantId?: string;
}

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    // Extract tenant from JWT token payload
    if (request.user && request.user.tenantId) {
      request.tenantId = request.user.tenantId;
    }

    // Allow tenant override via header for super-admin
    const headerTenantId = request.headers['x-tenant-id'] as string;
    if (headerTenantId && request.user?.role === 'super_admin') {
      request.tenantId = headerTenantId;
    }

    // For authenticated routes, ensure tenant context exists
    if (request.user && !request.tenantId) {
      throw new UnauthorizedException('Tenant context is required');
    }

    return next.handle();
  }
}
