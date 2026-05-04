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
import { AutomationRuntimeModule } from './runtime/automation-runtime.module';

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
  ],
  controllers: [HealthController],
})
export class AppModule {}
