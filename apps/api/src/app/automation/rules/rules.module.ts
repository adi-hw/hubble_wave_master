import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AutomationRule,
  AutomationRuleRevision,
} from '@hubblewave/instance-db';
import { AutomationRuntimeModule } from '../runtime/automation-runtime.module';
import { SchedulingModule } from '../scheduling/scheduling.module';
import { AvaModule } from '../ava/ava.module';
import { RulesController } from './rules.controller';
import { AutomationService } from './rules.service';

/**
 * REST surface for automation rule CRUD + the read endpoints over
 * scheduled jobs and execution logs. Relocated from svc-data in Plan
 * Fix 1, PR 5. AutomationRule + AutomationRuleRevision are registered
 * here as their canonical owner; AutomationRuntimeModule registers
 * AutomationRule too for the runtime's own queries — TypeORM tolerates
 * the duplicate forFeature.
 *
 * Uses forwardRef on AvaModule to resolve the rules ↔ ava cycle: the
 * controller injects AvaAutomationService while AvaAutomationService
 * delegates to AutomationService.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([AutomationRule, AutomationRuleRevision]),
    AutomationRuntimeModule,
    SchedulingModule,
    forwardRef(() => AvaModule),
  ],
  controllers: [RulesController],
  providers: [AutomationService],
  exports: [AutomationService],
})
export class RulesModule {}
