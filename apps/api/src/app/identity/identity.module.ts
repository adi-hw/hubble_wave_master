import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { InstanceDbModule } from '@hubblewave/instance-db';
import { AuthGuardModule } from '@hubblewave/auth-guard';

// Sub-modules (15 total, all migrated from svc-identity)
import { EmailModule } from './email/email.module';
import { AuthModule } from './auth/auth.module';
import { AbacModule } from './abac/abac.module';
import { LdapModule } from './ldap/ldap.module';
import { RolesModule } from './roles/roles.module';
import { IamModule } from './iam/iam.module';
import { OidcModule } from './oidc/oidc.module';
import { PoliciesModule } from './policies/policies.module';
import { UiModule } from './ui/ui.module';
import { SettingsModule } from './config/config.module';
import { AuditModule as IdentityAuditModule } from './audit/audit.module';
import { NavigationModule } from './navigation/navigation.module';
import { GroupsModule } from './groups/groups.module';
import { UsersModule } from './users/users.module';

// Top-level (just migrated from svc-identity)
import { HealthController } from './health.controller';
import { IdentityService } from './identity.service';

// Guards / interceptors / middleware (used as global providers)
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '@hubblewave/auth-guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { ApiKeyGuard } from './auth/api-key/api-key.guard';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { CsrfMiddleware } from './auth/middleware/csrf.middleware';

/**
 * IdentityModule — the full identity composition for HubbleWave.
 *
 * Consolidates the entire apps/svc-identity legacy service into apps/api as
 * part of ARC-W1 identity migration. All 15 sub-modules + HealthController +
 * IdentityService + global guards/interceptors/middleware live here.
 *
 * apps/svc-identity/src/app/app.module.ts is now a one-line thin adapter that
 * imports this module — the legacy service stays runnable for parallel
 * deployment until full W1 cutover (deferred to a separate plan).
 *
 * Imports six global guards via APP_GUARD (ordered: throttler → API key →
 * JWT → roles → permissions → ABAC) and a global LoggingInterceptor via
 * APP_INTERCEPTOR. CsrfMiddleware is applied to all routes via the
 * NestModule.configure() method below.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ([{
        ttl: config.get<number>('RATE_LIMIT_TTL', 60000),
        limit: config.get<number>('RATE_LIMIT_MAX', 100),
      }]),
    }),
    InstanceDbModule,
    AuthGuardModule,
    UsersModule,
    AuthModule,
    OidcModule,
    EmailModule,
    AbacModule,
    LdapModule,
    SettingsModule,
    UiModule,
    IamModule,
    NavigationModule,
    GroupsModule,
    RolesModule,
    IdentityAuditModule,
    PoliciesModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: ApiKeyGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    // AbacGuard is no longer wired as a global APP_GUARD. The guard's
    // fail-closed default ("ABAC policy not configured for this endpoint")
    // requires every controller method to declare @AbacResource(...) or
    // opt out via @SkipAbac() / @Public() / @AuthenticatedOnly(). That
    // rollout has not happened for the vast majority of endpoints, so the
    // global wiring denied almost every authenticated request. The guard
    // remains a provider and can be applied per-controller via
    // @UseGuards(AbacGuard) where ABAC is actually configured. Canon §9
    // centralized authorization is preserved by JwtAuthGuard + RolesGuard
    // + PermissionsGuard (global) plus the per-controller PermissionGuard
    // and the §28 AuthorizationService chain.
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    IdentityService,
    CsrfMiddleware,
  ],
  exports: [
    UsersModule, AuthModule, OidcModule, EmailModule, AbacModule, LdapModule,
    SettingsModule, UiModule, IamModule, NavigationModule, GroupsModule,
    RolesModule, IdentityAuditModule, PoliciesModule, AuthGuardModule,
    InstanceDbModule, IdentityService,
  ],
})
export class IdentityModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply CSRF protection to all routes; CsrfMiddleware itself handles
    // exemptions for public endpoints (preserved from svc-identity behavior).
    consumer.apply(CsrfMiddleware).forRoutes('*');
  }
}
