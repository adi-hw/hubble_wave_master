import { Module, forwardRef } from '@nestjs/common';
import { AutomationRuntimeModule } from '../runtime/automation-runtime.module';
import { RulesModule } from '../rules/rules.module';
import { AvaAutomationService } from './ava-automation.service';

/**
 * AVA bridge for automation rules. Provides natural-language CRUD
 * semantics over AutomationService (which lives in the rules module).
 *
 * Imports RulesModule via forwardRef to break the rules ↔ ava cycle:
 * rules.module imports ava.module for the controller's injection of
 * AvaAutomationService, and ava.module needs AutomationService from
 * rules.module for its own delegation. NestJS resolves both sides via
 * forwardRef without runtime overhead.
 *
 * Relocated from svc-data in Plan Fix 1, PR 5.
 */
@Module({
  imports: [AutomationRuntimeModule, forwardRef(() => RulesModule)],
  providers: [AvaAutomationService],
  exports: [AvaAutomationService],
})
export class AvaModule {}
