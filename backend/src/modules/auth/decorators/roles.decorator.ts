import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Decorator to specify which roles can access an endpoint.
 * Usage: @Roles('admin', 'doctor')
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
