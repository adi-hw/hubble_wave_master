import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuardModule } from './auth-guard.module';
import { JwtAuthGuard } from './jwt.guard';
import { RolesGuard } from './roles.guard';
import { PermissionsGuard } from './permissions.guard';

/**
 * Registers JwtAuthGuard, RolesGuard, and PermissionsGuard as APP_GUARD
 * providers so that the metadata produced by @Roles, @RequirePermission, and
 * related decorators is enforced for every route in the importing service.
 *
 * Endpoints that should be reachable without authentication must opt out via
 * the @Public() decorator from this library.
 *
 * Guard order (executed top-to-bottom):
 *   1. JwtAuthGuard       - validates the bearer token, populates request.user
 *   2. RolesGuard         - enforces @Roles(...) metadata
 *   3. PermissionsGuard   - enforces @RequirePermission(...) metadata
 */
@Module({
  imports: [AuthGuardModule],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
})
export class GlobalGuardsModule {}
