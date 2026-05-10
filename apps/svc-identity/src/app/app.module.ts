import { Module } from '@nestjs/common';
import { IdentityModule } from '../../../api/src/app/identity/identity.module';

/**
 * apps/svc-identity is kept alive in parallel during the ARC-W1 migration
 * for parallel-deployment safety. The actual module logic now lives in
 * apps/api/src/app/identity/IdentityModule. This thin adapter re-imports
 * IdentityModule wholesale so the legacy service serves the same endpoints
 * at its old port.
 *
 * IdentityModule's @Module decorator carries:
 * - All 15 sub-modules (auth, users, roles, groups, etc.)
 * - InstanceDbModule + AuthGuardModule (libs)
 * - ConfigModule.forRoot + ThrottlerModule
 * - 6 global APP_GUARD providers + APP_INTERCEPTOR
 * - HealthController + IdentityService
 * - CsrfMiddleware applied via NestModule.configure
 *
 * Importing IdentityModule into this thin app.module activates all of the
 * above when svc-identity bootstraps via apps/svc-identity/src/main.ts.
 *
 * Legacy service deletion is deferred to the W1 final-cutover plan.
 */
@Module({
  imports: [IdentityModule],
})
export class AppModule {}
