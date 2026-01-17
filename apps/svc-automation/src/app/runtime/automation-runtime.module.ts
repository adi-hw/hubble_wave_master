import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AutomationRule,
  AutomationExecutionLog,
  CollectionDefinition,
  PropertyDefinition,
  AuditLog,
  InstanceEventOutbox,
} from '@hubblewave/instance-db';
import { ConditionEvaluatorService } from './condition-evaluator.service';
import { ActionHandlerService } from './action-handler.service';
import { ScriptSandboxService } from './script-sandbox.service';
import { ExecutionLogService } from './execution-log.service';
import { RecordMutationService } from './record-mutation.service';
import { AutomationRuntimeService } from './automation-runtime.service';
import { OutboxProcessorService } from './outbox-processor.service';
import { OutboxPublisherService } from './outbox-publisher.service';

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
  ],
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
})
export class AutomationRuntimeModule {}
