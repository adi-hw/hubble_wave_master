import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Decorator to specify required roles for a route or controller.
 * User must have at least ONE of the specified roles.
 *
 * @example
 * ```typescript
 * @Roles('tenant_admin', 'platform_admin')
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Controller('admin')
 * export class AdminController {}
 * ```
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
