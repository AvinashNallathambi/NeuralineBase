import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { getEffectiveRoles } from '../../users/role-permissions';

interface AuthenticatedRequest {
  user?: {
    id: string;
    email: string;
    tenantId: string;
    role: string;
  };
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no roles are required, allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('No user context found');
    }

    // Use role inheritance so super_admin satisfies @Roles('admin') etc.
    const effectiveRoles = new Set(getEffectiveRoles(user.role));
    const hasRole = requiredRoles.some((role) => effectiveRoles.has(role));

    if (!hasRole) {
      throw new ForbiddenException(
        `User role "${user.role}" is not authorized. Required: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
