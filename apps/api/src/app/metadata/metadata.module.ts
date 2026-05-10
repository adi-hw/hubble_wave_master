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

/**
 * MetadataModule consolidates everything from apps/svc-metadata into the
 * apps/api modular monolith. Sub-modules migrate one at a time via git mv;
 * each migration registers its module here.
 *
 * Migration progress (per docs/superpowers/plans/2026-05-10-platform-w1-metadata-migration.md):
 *   [x] application
 *   [x] ava
 *   [ ] change-packages
 *   [ ] connectors
 *   [ ] decision-tables
 *   [x] display-rules
 *   [x] guided-processes
 *   [x] insights
 *   [ ] localization
 *   [ ] metadata
 *   [ ] navigation
 *   [ ] preferences
 *   [ ] property
 *   [x] script
 *   [ ] search
 *   [x] theme
 *   [x] view
 *   [ ] workspaces
 *   [ ] access
 *   [ ] publish-impact
 *   [ ] collection
 *   [ ] schema
 *   [ ] packs
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
    ApplicationModule,
    ScriptModule,
    ThemeModule,
    DisplayRuleModule,
    ViewModule,
    GuidedProcessModule,
    NavigationMetadataModule,
    DecisionTableModule,
    WorkspaceModule,
  ],
  controllers: [],
  providers: [
    InsightsIngestService,
    AvaIngestService,
    MetadataIngestService,
    ConnectorsIngestService,
  ],
  exports: [
    ApplicationModule,
    ScriptModule,
    ThemeModule,
    DisplayRuleModule,
    ViewModule,
    GuidedProcessModule,
    NavigationMetadataModule,
    DecisionTableModule,
    WorkspaceModule,
    InsightsIngestService,
    AvaIngestService,
    MetadataIngestService,
    ConnectorsIngestService,
  ],
})
export class MetadataModule {}
