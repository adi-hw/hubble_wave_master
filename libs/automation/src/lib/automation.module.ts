import { Module, Global } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TenantDbModule } from '@hubblewave/instance-db';
import { RuleEngineService } from './rule-engine.service';
import { EventBusService } from './event-bus.service';
import { WorkflowEngineService } from './workflow-engine.service';
import { ScriptSandboxService, ExpressionEvaluatorService } from './script-sandbox.service';

@Global()
@Module({
  imports: [
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      newListener: false,
      removeListener: false,
      maxListeners: 20,
      verboseMemoryLeak: true,
      ignoreErrors: false,
    }),
    TenantDbModule,
  ],
  providers: [
    RuleEngineService,
    EventBusService,
    WorkflowEngineService,
    ScriptSandboxService,
    ExpressionEvaluatorService,
  ],
  exports: [
    RuleEngineService,
    EventBusService,
    WorkflowEngineService,
    ScriptSandboxService,
    ExpressionEvaluatorService,
  ],
})
export class AutomationModule {}
