import { Module } from '@nestjs/common';
import { ScriptModule } from './script/script.module';

/**
 * MetadataModule consolidates everything from apps/svc-metadata into the
 * apps/api modular monolith. Sub-modules migrate one at a time via git mv;
 * each migration registers its module here.
 *
 * Migration progress (per docs/superpowers/plans/2026-05-10-platform-w1-metadata-migration.md):
 *   [ ] application
 *   [ ] ava
 *   [ ] change-packages
 *   [ ] connectors
 *   [ ] decision-tables
 *   [ ] display-rules
 *   [ ] guided-processes
 *   [ ] insights
 *   [ ] localization
 *   [ ] metadata
 *   [ ] navigation
 *   [ ] preferences
 *   [ ] property
 *   [x] script
 *   [ ] search
 *   [ ] theme
 *   [ ] view
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
    ScriptModule,
  ],
  controllers: [],
  providers: [],
  exports: [
    ScriptModule,
  ],
})
export class MetadataModule {}
