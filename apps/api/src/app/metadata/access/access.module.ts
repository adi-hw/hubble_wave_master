import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import {
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
import { ACCESS_AUDIT_PORT } from '@hubblewave/authorization';
import { AccessRuleService } from './services/access-rule.service';
import { AccessAuditService } from './services/access-audit.service';
import { BreakGlassService } from './services/break-glass.service';
import { AccessIngestService } from './services/access-ingest.service';
import { CollectionAccessGuard } from './guards/collection-access.guard';
import { PropertyAccessInterceptor } from './interceptors/property-access.interceptor';

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
  ],
  exports: [
    AccessRuleService,
    AccessAuditService,
    BreakGlassService,
    AccessIngestService,
    CollectionAccessGuard,
    PropertyAccessInterceptor,
    ACCESS_AUDIT_PORT,
  ],
})
export class AccessModule {}

