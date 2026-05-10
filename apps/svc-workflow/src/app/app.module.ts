import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import {
  AuthGuardModule,
  GlobalGuardsModule,
  MaintenanceModeModule,
} from '@hubblewave/auth-guard';
import { AuthorizationModule } from '@hubblewave/authorization';
import { AutomationModule } from '@hubblewave/automation';
import { InstanceDbModule } from '@hubblewave/instance-db';
import { RedisModule } from '@hubblewave/redis';
import { HealthController } from './health.controller';
import { WorkflowModule } from '../../../api/src/app/automation/workflow/workflow.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    InstanceDbModule,
    AuthGuardModule,
    GlobalGuardsModule,
    RedisModule.forRoot(),
    MaintenanceModeModule,
    AuthorizationModule.forInstance(),
    AutomationModule,
    ScheduleModule.forRoot(),
    WorkflowModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
