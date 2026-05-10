import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ConfigModule } from '@nestjs/config';
import { ScheduledJob } from '@hubblewave/instance-db';
import { RedisModule } from '@hubblewave/redis';
import { AutomationRuntimeModule } from '../../../../api/src/app/automation/runtime/automation-runtime.module';
import { ScheduledJobService } from './scheduled-job.service';
import { SchedulerService } from './scheduler.service';
import { AutomationRateLimiterService } from './automation-rate-limiter.service';

/**
 * Scheduled-job execution. Hosts cron-driven automation runs through
 * BullMQ; relocated from svc-data in Plan Fix 1, PR 5. Depends on
 * AutomationRuntimeModule for the action-handler / script-sandbox /
 * execution-log primitives the worker calls per job.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([ScheduledJob]),
    EventEmitterModule.forRoot(),
    ConfigModule,
    RedisModule.forRoot(),
    AutomationRuntimeModule,
  ],
  providers: [
    ScheduledJobService,
    SchedulerService,
    AutomationRateLimiterService,
  ],
  exports: [
    ScheduledJobService,
    SchedulerService,
    AutomationRateLimiterService,
  ],
})
export class SchedulingModule {}
