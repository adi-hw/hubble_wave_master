import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthGuardModule } from '@hubblewave/auth-guard';
import { AuthorizationModule } from '@hubblewave/authorization';
import { AutomationModule } from '@hubblewave/automation';
import { InstanceDbModule } from '@hubblewave/instance-db';
import { HealthController } from './health.controller';
import { WorkflowModule } from './workflow/workflow.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    InstanceDbModule,
    AuthGuardModule,
    AuthorizationModule.forInstance(),
    AutomationModule,
    ScheduleModule.forRoot(),
    WorkflowModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
