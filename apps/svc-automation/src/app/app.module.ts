import { Module } from '@nestjs/common';
import { AutomationModule } from '../../../api/src/app/automation/automation.module';

/**
 * apps/svc-automation is kept alive in parallel during the ARC-W1 migration
 * for parallel-deployment safety. The actual module logic now lives in
 * apps/api/src/app/automation/AutomationModule. This thin adapter re-imports
 * AutomationModule wholesale so the legacy service serves the same endpoints
 * at its old port.
 *
 * Legacy service deletion is deferred to the W1 final-cutover plan.
 */
@Module({
  imports: [AutomationModule],
})
export class AppModule {}
