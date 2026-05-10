import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NavigationController } from './navigation.controller';
import { NavigationAdminController } from './navigation-admin.controller';
import { NavigationResolutionService } from './navigation-resolution.service';
import { ModuleRegistryService } from './module-registry.service';
import { NavigationCacheService } from './navigation-cache.service';
import { NavigationPreferenceService } from './navigation-preference.service';
import { VisibilityExpressionService } from './visibility-expression.service';
import { NavProfile, NavNode, NavPatch, UserPreference } from '@hubblewave/instance-db';

@Module({
  imports: [
    TypeOrmModule.forFeature([NavProfile, NavNode, NavPatch, UserPreference]),
  ],
  controllers: [NavigationController, NavigationAdminController],
  providers: [
    NavigationResolutionService,
    ModuleRegistryService,
    NavigationCacheService,
    NavigationPreferenceService,
    VisibilityExpressionService,
  ],
  exports: [NavigationResolutionService],
})
export class NavigationModule {}
