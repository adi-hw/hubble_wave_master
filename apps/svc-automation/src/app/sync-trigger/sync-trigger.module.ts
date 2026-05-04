import { Module } from '@nestjs/common';
import { AutomationRuntimeModule } from '../runtime/automation-runtime.module';
import { SyncTriggerController } from './sync-trigger.controller';
import { SyncTriggerService } from './sync-trigger.service';

/**
 * Sync-trigger module — exposes svc-automation's synchronous execution
 * path over HTTP. Depends on AutomationRuntimeModule for the
 * AutomationRuntimeService that owns the actual execution logic.
 */
@Module({
  imports: [AutomationRuntimeModule],
  controllers: [SyncTriggerController],
  providers: [SyncTriggerService],
})
export class SyncTriggerModule {}
