import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AutomationRule,
  AutomationExecutionLog,
  CollectionDefinition,
  PropertyDefinition,
  AuditLog,
  InstanceEventOutbox,
  RuntimeAnomalyModule,
} from '@hubblewave/instance-db';
import { ConditionEvaluatorService } from './condition-evaluator.service';
import { ActionHandlerService } from './action-handler.service';
import { ScriptSandboxService } from './script-sandbox.service';
import { ExecutionLogService } from './execution-log.service';
import { RecordMutationService } from './record-mutation.service';
import { AutomationRuntimeService } from './automation-runtime.service';
import { OutboxProcessorService } from './outbox-processor.service';
import { OutboxPublisherService } from './outbox-publisher.service';
import { AvaAutomationController } from './ava-automation.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AutomationRule,
      AutomationExecutionLog,
      CollectionDefinition,
      PropertyDefinition,
      AuditLog,
      InstanceEventOutbox,
    ]),
    RuntimeAnomalyModule,
  ],
  controllers: [AvaAutomationController],
  providers: [
    ConditionEvaluatorService,
    ActionHandlerService,
    ScriptSandboxService,
    ExecutionLogService,
    RecordMutationService,
    AutomationRuntimeService,
    OutboxPublisherService,
    OutboxProcessorService,
  ],
  exports: [
    AutomationRuntimeService,
    // Exposed because consuming modules inject these services directly:
    // - RulesController injects ExecutionLogService for log read endpoints
    // - AvaAutomationService injects ConditionEvaluatorService for AVA-driven
    //   condition checks
    // - SchedulerService injects ActionHandlerService, ScriptSandboxService,
    //   and ExecutionLogService for scheduled job execution
    ActionHandlerService,
    ScriptSandboxService,
    ExecutionLogService,
    ConditionEvaluatorService,
    ActionHandlerService,
    ScriptSandboxService,
  ],
})
export class AutomationRuntimeModule {}
