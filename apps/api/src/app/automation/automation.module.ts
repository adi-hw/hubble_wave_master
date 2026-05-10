import { Module } from '@nestjs/common';
import { AutomationRuntimeModule } from './runtime/automation-runtime.module';

/**
 * AutomationModule consolidates everything from apps/svc-automation into the
 * apps/api modular monolith. Sub-modules migrate one at a time via git mv;
 * each migration registers its module here.
 *
 * Migration progress (per docs/superpowers/plans/2026-05-10-platform-w1-automation-migration.md):
 *   Standard modules (clean-DAG order):
 *     [x] runtime (AutomationRuntimeModule — leaf)
 *     [ ] scheduling (depends on runtime)
 *     [ ] sync-trigger (depends on runtime)
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
  imports: [AutomationRuntimeModule],
  controllers: [],
  providers: [],
  exports: [AutomationRuntimeModule],
})
export class AutomationModule {}
