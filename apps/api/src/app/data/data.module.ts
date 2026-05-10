import { Module } from '@nestjs/common';
import { WorkflowModule } from './workflow/workflow.module';
import { EventOutboxService } from './events/event-outbox.service';
import { SyncTriggerClientService } from './automation/sync-trigger-client.service';
import { DefaultsModule } from './defaults/defaults.module';
import { ValidationModule } from './validation/validation.module';
import { AVAModule } from './ava/ava.module';
import { FormulaModule } from './formula/formula.module';
import { ComputedModule } from './computed/computed.module';

/**
 * DataModule consolidates everything from apps/svc-data into the apps/api
 * modular monolith. Sub-modules migrate one at a time via git mv; each
 * migration registers its module here.
 *
 * Migration progress (per docs/superpowers/plans/2026-05-10-platform-w1-data-migration.md):
 *   Standard modules:
 *     [x] workflow
 *     [x] defaults
 *     [x] validation
 *     [x] ava
 *     [x] formula
 *     [x] computed
 *     [ ] integration
 *     [ ] grid
 *   Service-only sub-directories:
 *     [x] events
 *     [x] automation
 *     [ ] work
 *     [ ] offerings
 *   Top-level service files (mid-stream):
 *     [ ] collection-data.service + spec
 *     [ ] model-registry.service
 *   Final top-level (controllers, data.service, app.module thin adapter):
 *     [ ] data.controller, health.controller, collection-data.controller
 *     [ ] data.service + spec
 *     [ ] data.module final composition
 *     [ ] svc-data app.module thin adapter
 *
 * DataModule re-exports each migrated sub-module so that:
 * - apps/api consumers (automation, ava, etc.) can inject data services
 *   without explicit sub-module imports
 * - apps/svc-data's thin adapter (post-migration) can import DataModule
 *   wholesale to keep the legacy service serving the same endpoints
 */
@Module({
  imports: [WorkflowModule, DefaultsModule, ValidationModule, AVAModule, FormulaModule, ComputedModule],
  controllers: [],
  providers: [EventOutboxService, SyncTriggerClientService],
  exports: [WorkflowModule, EventOutboxService, SyncTriggerClientService, DefaultsModule, ValidationModule, AVAModule, FormulaModule, ComputedModule],
})
export class DataModule {}
