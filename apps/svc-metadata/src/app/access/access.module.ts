import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import {
  CollectionAccessRule,
  PropertyAccessRule,
  PropertyDefinition,
  AccessAuditLog,
  AccessRuleAuditLog,
  BreakGlassSession,
  Role,
  Group,
  User,
} from '@hubblewave/instance-db';
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
  ],
  exports: [
    AccessRuleService,
    AccessAuditService,
    BreakGlassService,
    AccessIngestService,
    CollectionAccessGuard,
    PropertyAccessInterceptor,
  ],
})
export class AccessModule {}

