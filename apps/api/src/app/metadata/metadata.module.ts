import { Module } from '@nestjs/common';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import {
  AuthGuardModule,
  GlobalGuardsModule,
  MaintenanceModeModule,
} from '@hubblewave/auth-guard';
import {
  AuthorizationModule,
  COLLECTION_ACL_REPOSITORY,
  PROPERTY_ACL_REPOSITORY,
} from '@hubblewave/authorization';
import {
  InstanceDbModule,
  CollectionAccessRule,
  PropertyAccessRule,
} from '@hubblewave/instance-db';
import { RedisModule } from '@hubblewave/redis';

// 18 sub-modules with Module wrappers
import { ScriptModule } from './script/script.module';
import { ApplicationModule } from './application/application.module';
import { ThemeModule } from './theme/theme.module';
import { DisplayRuleModule } from './display-rules/display-rule.module';
import { ViewModule } from './view/view.module';
import { GuidedProcessModule } from './guided-processes/guided-process.module';
import { NavigationMetadataModule } from './navigation/navigation.module';
import { DecisionTableModule } from './decision-tables/decision-table.module';
import { WorkspaceModule } from './workspaces/workspace.module';
import { SearchModule } from './search/search.module';
import { PreferencesModule } from './preferences/preferences.module';
import { LocalizationModule } from './localization/localization.module';
import { ChangePackageModule } from './change-packages/change-package.module';
import { PropertyModule } from './property/property.module';
import { AccessModule } from './access/access.module';
import { PublishImpactModule } from './publish-impact/publish-impact.module';
import { CollectionModule } from './collection/collection.module';
import { PacksModule } from './packs/packs.module';

// 4 service-only sub-module providers (no Module wrapper)
import { InsightsIngestService } from './insights/insights-ingest.service';
import { AvaIngestService } from './ava/ava-ingest.service';
import { MetadataIngestService } from './metadata/metadata-ingest.service';
import { ConnectorsIngestService } from './connectors/connectors-ingest.service';

// Schema sub-module (no Module wrapper)
import { SchemaController } from './schema/schema.controller';
import { SchemaDeployService } from './schema/schema-deploy.service';
import { SchemaDiffService } from './schema/schema-diff.service';

// Top-level controllers and services (migrated in this final task)
import { MetadataHealthController } from './metadata-health.controller';
import { MetadataController } from './metadata.controller';
import { ModelController } from './model.controller';
import { ModuleController } from './module.controller';
import { ModelRegistryService } from './model-registry.service';
import { ModuleService } from './module.service';

/**
 * MetadataModule — the full metadata composition for HubbleWave.
 *
 * Consolidates the entire apps/svc-metadata legacy service into apps/api as
 * part of ARC-W1 metadata migration. All 23 sub-modules + top-level
 * controllers + services + global wiring live here.
 *
 * apps/svc-metadata/src/app/app.module.ts is now a one-line thin adapter that
 * imports this module — the legacy service stays runnable for parallel
 * deployment until full W1 cutover (deferred to a separate plan).
 *
 * HealthController renamed to MetadataHealthController (route /metadata/health)
 * to disambiguate from identity's HealthController (route /health) which is
 * already in the same modular monolith.
 */
@Module({
  imports: [
    InstanceDbModule,
    AuthGuardModule,
    GlobalGuardsModule,
    RedisModule.forRoot(),
    MaintenanceModeModule,
    EventEmitterModule.forRoot(),
    TypeOrmModule.forFeature([CollectionAccessRule, PropertyAccessRule]),
    AuthorizationModule.forRoot({
      enableCaching: true,
    }),
    // 18 sub-modules with Module wrappers
    ApplicationModule,
    PropertyModule,
    AccessModule,
    CollectionModule,
    PublishImpactModule,
    DisplayRuleModule,
    DecisionTableModule,
    GuidedProcessModule,
    WorkspaceModule,
    ChangePackageModule,
    ThemeModule,
    PreferencesModule,
    ViewModule,
    NavigationMetadataModule,
    ScriptModule,
    PacksModule,
    SearchModule,
    LocalizationModule,
  ],
  controllers: [
    MetadataHealthController,
    ModuleController,
    ModelController,
    MetadataController,
    SchemaController,
  ],
  providers: [
    ModuleService,
    ModelRegistryService,
    SchemaDiffService,
    SchemaDeployService,
    InsightsIngestService,
    AvaIngestService,
    MetadataIngestService,
    ConnectorsIngestService,
    {
      provide: COLLECTION_ACL_REPOSITORY,
      useFactory: (repo: Repository<CollectionAccessRule>) => repo,
      inject: [getRepositoryToken(CollectionAccessRule)],
    },
    {
      provide: PROPERTY_ACL_REPOSITORY,
      useFactory: (repo: Repository<PropertyAccessRule>) => repo,
      inject: [getRepositoryToken(PropertyAccessRule)],
    },
  ],
  exports: [
    // Re-export all sub-modules + top-level services so apps/api consumers
    // can inject them without explicit imports.
    ApplicationModule,
    PropertyModule,
    AccessModule,
    CollectionModule,
    PublishImpactModule,
    DisplayRuleModule,
    DecisionTableModule,
    GuidedProcessModule,
    WorkspaceModule,
    ChangePackageModule,
    ThemeModule,
    PreferencesModule,
    ViewModule,
    NavigationMetadataModule,
    ScriptModule,
    PacksModule,
    SearchModule,
    LocalizationModule,
    InsightsIngestService,
    AvaIngestService,
    MetadataIngestService,
    ConnectorsIngestService,
    SchemaDeployService,
    SchemaDiffService,
    ModuleService,
    ModelRegistryService,
  ],
})
export class MetadataModule {}
