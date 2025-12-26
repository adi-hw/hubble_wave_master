import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { InstanceDbModule } from '@hubblewave/instance-db';
import { ActionHandlerService } from './action-handler.service';
import { AutomationExecutorService } from './automation-executor.service';
import { AutomationService } from './automation.service';
import { ConditionEvaluatorService } from './condition-evaluator.service';
import { ExecutionLogService } from './execution-log.service';
import { SchedulerService } from './scheduler.service';
import { ScriptApiBridgeService } from './script-api-bridge.service';
import { ScriptSandboxService } from './script-sandbox.service';

@Module({
  imports: [InstanceDbModule, EventEmitterModule.forRoot()],
  providers: [
    ActionHandlerService,
    AutomationExecutorService,
    AutomationService,
    ConditionEvaluatorService,
    ExecutionLogService,
    SchedulerService,
    ScriptApiBridgeService,
    ScriptSandboxService,
  ],
  exports: [
    AutomationExecutorService,
    AutomationService,
    ConditionEvaluatorService,
    SchedulerService,
    ActionHandlerService,
  ],
})
export class AutomationModule {}

