import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthGuardModule } from '@hubblewave/auth-guard';
import { AuthorizationModule } from '@hubblewave/authorization';
import { InstanceDbModule } from '@hubblewave/instance-db';
import { HealthController } from './health.controller';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    InstanceDbModule,
    AuthGuardModule,
    AuthorizationModule.forInstance(),
    ScheduleModule.forRoot(),
    NotificationsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
