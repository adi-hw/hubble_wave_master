/**
 * AutomationModule
 * HubbleWave Platform - Phase 3
 *
 * Module for business rules, triggers, and scheduled jobs.
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import {
  AutomationRule,
  ScheduledJob,
  AutomationExecutionLog,
  ClientScript,
} from '@hubblewave/instance-db';
import { AutomationController } from './automation.controller';
import { ActionHandlerService } from './action-handler.service';
import { AutomationExecutorService } from './automation-executor.service';
import { AutomationService } from './automation.service';
import { ConditionEvaluatorService } from './condition-evaluator.service';
import { ExecutionLogService } from './execution-log.service';
import { ScheduledJobService } from './scheduled-job.service';
import { SchedulerService } from './scheduler.service';
import { ScriptApiBridgeService } from './script-api-bridge.service';
import { ScriptSandboxService } from './script-sandbox.service';
import { AvaAutomationService } from './ava-automation.service';
import { ConditionValidatorService } from './condition-validator.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AutomationRule,
      ScheduledJob,
      AutomationExecutionLog,
      ClientScript,
    ]),
    EventEmitterModule.forRoot(),
  ],
  controllers: [AutomationController],
  providers: [
    ActionHandlerService,
    AutomationExecutorService,
    AutomationService,
    AvaAutomationService,
    ConditionEvaluatorService,
    ConditionValidatorService,
    ExecutionLogService,
    ScheduledJobService,
    SchedulerService,
    ScriptApiBridgeService,
    ScriptSandboxService,
  ],
  exports: [
    AutomationExecutorService,
    AutomationService,
    AvaAutomationService,
    ConditionEvaluatorService,
    ConditionValidatorService,
    ExecutionLogService,
    ScheduledJobService,
    SchedulerService,
    ActionHandlerService,
  ],
})
export class AutomationModule {}
