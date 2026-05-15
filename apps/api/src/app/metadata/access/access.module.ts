import { Module, Global, OnModuleInit, Logger } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import {
  AccessRuleCacheInvalidationSubscriber,
  CollectionAccessRule,
  CollectionDefinition,
  PropertyAccessRule,
  PropertyDefinition,
  AccessAuditLog,
  AccessRuleAuditLog,
  BreakGlassSession,
  Role,
  Group,
  User,
} from '@hubblewave/instance-db';
import {
  ACCESS_AUDIT_PORT,
  ACCESS_RULE_CACHE_INVALIDATION_PORT,
  AuthorizationService,
} from '@hubblewave/authorization';
import { AccessRuleService } from './services/access-rule.service';
import { AccessAuditService } from './services/access-audit.service';
import { BreakGlassService } from './services/break-glass.service';
import { AccessIngestService } from './services/access-ingest.service';
import { CollectionAccessGuard } from './guards/collection-access.guard';
import { PropertyAccessInterceptor } from './interceptors/property-access.interceptor';
import { ExplainController } from './explain.controller';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      CollectionAccessRule,
      CollectionDefinition,
      PropertyAccessRule,
      PropertyDefinition,
      AccessAuditLog,
      AccessRuleAuditLog,
      BreakGlassSession,
      Role,
      Group,
      User,
    ]),
    CacheModule.register(),
  ],
  // §28.7: explain endpoint exposed via ExplainController. The controller
  // depends on AuthorizationService (already injected from the authorization
  // lib) and IDENTITY_RESOLVER_PORT (bound + exported by `@Global()`
  // AuthModule — see apps/api/src/app/identity/auth/auth.module.ts. The
  // global registration means we get the port via DI without a cross-
  // service `imports: [AuthModule]` line, which would violate canon §3
  // service-boundary topology — caught by tools/service-boundary-check.ts).
  controllers: [ExplainController],
  providers: [
    AccessRuleService,
    AccessAuditService,
    BreakGlassService,
    AccessIngestService,
    CollectionAccessGuard,
    PropertyAccessInterceptor,
    // F021: bind AccessAuditService as the AccessAuditPort implementation
    // so AuthorizationService (in libs/authorization) can emit admin-bypass
    // audit rows via DI without depending on apps/api types.
    {
      provide: ACCESS_AUDIT_PORT,
      useExisting: AccessAuditService,
    },
    // F025: bind AuthorizationService as the cache-invalidation port
    // implementation. The TypeORM subscriber publishes to this port via
    // the static `setPublisher` wiring done in `onModuleInit` below.
    {
      provide: ACCESS_RULE_CACHE_INVALIDATION_PORT,
      useExisting: AuthorizationService,
    },
  ],
  exports: [
    AccessRuleService,
    AccessAuditService,
    BreakGlassService,
    AccessIngestService,
    CollectionAccessGuard,
    PropertyAccessInterceptor,
    ACCESS_AUDIT_PORT,
    ACCESS_RULE_CACHE_INVALIDATION_PORT,
  ],
})
export class AccessModule implements OnModuleInit {
  private readonly logger = new Logger(AccessModule.name);

  constructor(private readonly authorizationService: AuthorizationService) {}

  /**
   * F025: bind the cache-invalidation publisher into the TypeORM subscriber.
   * Subscribers run outside Nest's DI graph (they are constructed when the
   * data source initialises during bootstrap), so we hand them the
   * resolved `AuthorizationService` explicitly once the Nest module
   * graph is up. Mirrors `RolesModule.onModuleInit` for
   * `IdentityCacheInvalidationSubscriber` (W1.7).
   */
  onModuleInit(): void {
    AccessRuleCacheInvalidationSubscriber.setPublisher(this.authorizationService);
    this.logger.log(
      'F025: AccessRuleCacheInvalidationSubscriber publisher bound to AuthorizationService',
    );
  }
}

