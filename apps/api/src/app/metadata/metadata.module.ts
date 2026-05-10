import { Module } from '@nestjs/common';
import { ScriptModule } from './script/script.module';
import { ApplicationModule } from './application/application.module';
import { InsightsIngestService } from './insights/insights-ingest.service';
import { AvaIngestService } from './ava/ava-ingest.service';
import { ThemeModule } from './theme/theme.module';
import { DisplayRuleModule } from './display-rules/display-rule.module';
import { ViewModule } from './view/view.module';
import { GuidedProcessModule } from './guided-processes/guided-process.module';
import { NavigationMetadataModule } from './navigation/navigation.module';
import { MetadataIngestService } from './metadata/metadata-ingest.service';
import { ConnectorsIngestService } from './connectors/connectors-ingest.service';
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
import { SchemaController } from './schema/schema.controller';
import { SchemaDeployService } from './schema/schema-deploy.service';
import { SchemaDiffService } from './schema/schema-diff.service';
import { PacksModule } from './packs/packs.module';

/**
 * MetadataModule consolidates everything from apps/svc-metadata into the
 * apps/api modular monolith. Sub-modules migrate one at a time via git mv;
 * each migration registers its module here.
 *
 * Migration progress (per docs/superpowers/plans/2026-05-10-platform-w1-metadata-migration.md):
 *   [x] application
 *   [x] ava
 *   [x] change-packages
 *   [x] connectors
 *   [x] decision-tables
 *   [x] display-rules
 *   [x] guided-processes
 *   [x] insights
 *   [x] localization
 *   [x] metadata
 *   [x] navigation
 *   [x] preferences
 *   [x] property
 *   [x] script
 *   [x] search
 *   [x] theme
 *   [x] view
 *   [x] workspaces
 *   [x] access
 *   [x] publish-impact
 *   [x] collection
 *   [x] schema
 *   [x] packs
 *   [ ] top-level (HealthController + Metadata/Model/Module controllers + services + thin adapter)
 *
 * MetadataModule re-exports each migrated sub-module so that:
 * - apps/api consumers (data, automation, etc.) can inject metadata services
 *   without explicit sub-module imports
 * - apps/svc-metadata's thin adapter (post-migration) can import MetadataModule
 *   wholesale to keep the legacy service serving the same endpoints
 */
@Module({
  imports: [
    AccessModule,
    ApplicationModule,
    ChangePackageModule,
    CollectionModule,
    LocalizationModule,
    PreferencesModule,
    PropertyModule,
    PublishImpactModule,
    ScriptModule,
    SearchModule,
    ThemeModule,
    DisplayRuleModule,
    ViewModule,
    GuidedProcessModule,
    NavigationMetadataModule,
    DecisionTableModule,
    WorkspaceModule,
    PacksModule,
  ],
  controllers: [SchemaController],
  providers: [
    InsightsIngestService,
    AvaIngestService,
    MetadataIngestService,
    ConnectorsIngestService,
    SchemaDeployService,
    SchemaDiffService,
  ],
  exports: [
    AccessModule,
    ApplicationModule,
    ChangePackageModule,
    CollectionModule,
    LocalizationModule,
    PreferencesModule,
    PropertyModule,
    PublishImpactModule,
    ScriptModule,
    SearchModule,
    ThemeModule,
    DisplayRuleModule,
    ViewModule,
    GuidedProcessModule,
    NavigationMetadataModule,
    DecisionTableModule,
    WorkspaceModule,
    PacksModule,
    InsightsIngestService,
    AvaIngestService,
    MetadataIngestService,
    ConnectorsIngestService,
    SchemaDeployService,
    SchemaDiffService,
  ],
})
export class MetadataModule {}
