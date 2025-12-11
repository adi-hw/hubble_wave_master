import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantDbModule } from '@eam-platform/tenant-db';
import {
  TenantNavProfile,
  TenantNavProfileItem,
  NavPatch,
  ModuleEntity,
} from '@eam-platform/tenant-db';
import { NavigationController } from './navigation.controller';
import { NavigationAdminController } from './navigation-admin.controller';
import { NavigationResolutionService } from './navigation-resolution.service';
import { ModuleRegistryService } from './module-registry.service';
import { VisibilityExpressionService } from './visibility-expression.service';
import { NavigationCacheService } from './navigation-cache.service';
import { NavigationPreferenceService } from './navigation-preference.service';
import { LegacyAdapterService } from './legacy-adapter.service';

/**
 * NavigationModule - Next-gen multi-tenant navigation system
 *
 * Provides:
 * - NavigationResolutionService: Core navigation resolution logic
 * - ModuleRegistryService: Module lookups and route resolution
 * - VisibilityExpressionService: DSL expression evaluation for visibility
 * - NavigationCacheService: Caching layer for performance
 * - NavigationPreferenceService: User preferences (favorites, profile selection)
 * - LegacyAdapterService: V1/V2 format conversion for backward compatibility
 * - NavigationController: REST API endpoints for user navigation
 * - NavigationAdminController: Admin endpoints for profile/node/patch management
 *
 * Features:
 * - Template-based navigation with patch customization
 * - Role/permission/feature-flag based visibility
 * - Smart groups (favorites, recent, frequent)
 * - Multi-profile support with auto-assignment
 * - Command palette search
 * - Backward compatibility with V1 navigation format
 */
@Module({
  imports: [
    TenantDbModule,
    TypeOrmModule.forFeature([
      TenantNavProfile,
      TenantNavProfileItem,
      NavPatch,
      ModuleEntity,
    ]),
  ],
  controllers: [NavigationController, NavigationAdminController],
  providers: [
    NavigationResolutionService,
    ModuleRegistryService,
    VisibilityExpressionService,
    NavigationCacheService,
    NavigationPreferenceService,
    LegacyAdapterService,
  ],
  exports: [
    NavigationResolutionService,
    ModuleRegistryService,
    VisibilityExpressionService,
    NavigationCacheService,
    NavigationPreferenceService,
    LegacyAdapterService,
  ],
})
export class NavigationModule {}
