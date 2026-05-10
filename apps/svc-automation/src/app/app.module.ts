import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  AuthGuardModule,
  GlobalGuardsModule,
  MaintenanceModeModule,
} from '@hubblewave/auth-guard';
import { AutomationModule } from '@hubblewave/automation';
import { AuthorizationModule } from '@hubblewave/authorization';
import { RedisModule } from '@hubblewave/redis';
import { HealthController } from './health.controller';
import { AutomationRuntimeModule } from '../../../api/src/app/automation/runtime/automation-runtime.module';
import { SyncTriggerModule } from '../../../api/src/app/automation/sync-trigger/sync-trigger.module';
import { RulesModule } from './rules/rules.module';
import { SchedulingModule } from '../../../api/src/app/automation/scheduling/scheduling.module';
import { AvaModule } from './ava/ava.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthGuardModule,
    GlobalGuardsModule,
    RedisModule.forRoot(),
    MaintenanceModeModule,
    AutomationModule,
    AuthorizationModule.forInstance(),
    AutomationRuntimeModule,
    SyncTriggerModule,
    RulesModule,
    SchedulingModule,
    AvaModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
