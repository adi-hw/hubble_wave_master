import { Module } from '@nestjs/common';
import { AutomationRuntimeModule } from './runtime/automation-runtime.module';
import { SchedulingModule } from './scheduling/scheduling.module';
import { SyncTriggerModule } from './sync-trigger/sync-trigger.module';

/**
 * AutomationModule consolidates everything from apps/svc-automation into the
 * apps/api modular monolith. Sub-modules migrate one at a time via git mv;
 * each migration registers its module here.
 *
 * Migration progress (per docs/superpowers/plans/2026-05-10-platform-w1-automation-migration.md):
 *   Standard modules (clean-DAG order):
 *     [x] runtime (AutomationRuntimeModule — leaf)
 *     [x] scheduling (depends on runtime)
 *     [x] sync-trigger (depends on runtime)
 *   Cyclic-core bundle (atomic single-commit, ava ↔ rules):
 *     [ ] ava + rules
 *   Final top-level (controller, app.module thin adapter):
 *     [ ] automation-health.controller (renamed from health.controller)
 *     [ ] automation.module final composition
 *     [ ] svc-automation app.module thin adapter
 *
 * AutomationModule re-exports each migrated sub-module so that:
 * - apps/api consumers (data, ava, etc.) can inject automation services
 *   without explicit sub-module imports
 * - apps/svc-automation's thin adapter (post-migration) can import
 *   AutomationModule wholesale to keep the legacy service serving the same
 *   endpoints
 */
@Module({
  imports: [AutomationRuntimeModule, SchedulingModule, SyncTriggerModule],
  controllers: [],
  providers: [],
  exports: [AutomationRuntimeModule, SchedulingModule, SyncTriggerModule],
})
export class AutomationModule {}
