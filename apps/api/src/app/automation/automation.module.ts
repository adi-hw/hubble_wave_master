import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  AuthGuardModule,
  GlobalGuardsModule,
  MaintenanceModeModule,
} from '@hubblewave/auth-guard';
import { AutomationModule as AutomationLibModule } from '@hubblewave/automation';
import { AuthorizationModule } from '@hubblewave/authorization';
import { RedisModule } from '@hubblewave/redis';

import { AutomationHealthController } from './automation-health.controller';

import { AutomationRuntimeModule } from './runtime/automation-runtime.module';
import { SchedulingModule } from './scheduling/scheduling.module';
import { SyncTriggerModule } from './sync-trigger/sync-trigger.module';
import { AvaModule } from './ava/ava.module';
import { RulesModule } from './rules/rules.module';
import { WorkflowModule } from './workflow/workflow.module';

/**
 * AutomationModule — canonical home for the automation plane (formerly apps/svc-automation).
 *
 * Migration progress (per docs/superpowers/plans/2026-05-10-platform-w1-automation-migration.md):
 *   Standard modules (clean-DAG order):
 *     [x] runtime (AutomationRuntimeModule — leaf)
 *     [x] scheduling (depends on runtime)
 *     [x] sync-trigger (depends on runtime)
 *   Cyclic-core bundle (atomic single-commit, ava ↔ rules):
 *     [x] ava + rules
 *   Workflow (folded under automation per canon §8 INVERT):
 *     [x] workflow (WorkflowModule — migrated 2026-05-10 via arc-w1-workflow-complete)
 *   Final top-level (controller, app.module thin adapter):
 *     [x] automation-health.controller (renamed from health.controller; route 'automation/health')
 *     [x] automation.module final composition
 *     [x] svc-automation app.module thin adapter
 *
 * apps/svc-automation is reduced to a thin adapter that imports AutomationModule
 * from apps/api so the legacy service serves the same endpoints during parallel
 * deployment. Legacy service deletion is deferred to W1 final cutover.
 *
 * Note: AutomationModule from @hubblewave/automation lib is aliased here as
 * AutomationLibModule to disambiguate from this file's exported AutomationModule.
 */
@Module({
  imports: [
    // Lib-level wiring (preserved from svc-automation's app.module.ts)
    ConfigModule.forRoot({ isGlobal: true }),
    AuthGuardModule,
    GlobalGuardsModule,
    RedisModule.forRoot(),
    MaintenanceModeModule,
    AutomationLibModule, // alias — was `AutomationModule` from @hubblewave/automation
    AuthorizationModule.forInstance(),
    // Sub-modules (post-migration, all at apps/api/src/app/automation/<sub>/)
    AutomationRuntimeModule,
    SchedulingModule,
    SyncTriggerModule,
    AvaModule,
    RulesModule,
    WorkflowModule,
  ],
  controllers: [AutomationHealthController],
  providers: [],
  exports: [
    AutomationRuntimeModule,
    SchedulingModule,
    SyncTriggerModule,
    AvaModule,
    RulesModule,
    WorkflowModule,
  ],
})
export class AutomationModule {}
