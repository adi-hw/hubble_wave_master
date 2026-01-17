import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { InstanceDbModule } from '@hubblewave/instance-db';
import { EventBusService } from './event-bus.service';
import { ProcessFlowEngineService } from './process-flow-engine.service';
import { ProcessFlowQueueService } from './process-flow-queue.service';

@Global()
@Module({
  imports: [
    ConfigModule,
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      newListener: false,
      removeListener: false,
      maxListeners: 20,
      verboseMemoryLeak: true,
      ignoreErrors: false,
    }),
    InstanceDbModule,
  ],
  providers: [
    EventBusService,
    ProcessFlowEngineService,
    ProcessFlowQueueService,
  ],
  exports: [
    EventBusService,
    ProcessFlowEngineService,
    ProcessFlowQueueService,
  ],
})
export class AutomationModule {}
