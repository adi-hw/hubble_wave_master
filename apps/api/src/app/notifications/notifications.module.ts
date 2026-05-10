import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthGuardModule, GlobalGuardsModule } from '@hubblewave/auth-guard';
import { AuthorizationModule } from '@hubblewave/authorization';
import {
  AuditLog,
  InAppNotification,
  InstanceEventOutbox,
  NotificationHistory,
  NotificationQueue,
  NotificationTemplate,
  RuntimeAnomalyModule,
  User,
  UserNotificationPreferences,
} from '@hubblewave/instance-db';
import { NotificationService } from './notification.service';
import { InAppNotificationService } from './in-app-notification.service';
import { TemplateEngineService } from './template-engine.service';
import { NotificationOutboxProcessor } from './notification-outbox-processor.service';
import { NotificationTemplatesController } from './notification-templates.controller';
import { NotificationsController } from './notifications.controller';
import { InAppNotificationsController } from './in-app-notifications.controller';
import { NotificationsHealthController } from './notifications-health.controller';
import { ChannelProviderRegistry, SmtpEmailProvider } from './channel-providers';

/**
 * NotificationsModule consolidates svc-notify into apps/api per spec §2.
 * Flattened layout: all files from svc-notify/notifications/ live directly
 * at apps/api/src/app/notifications/ (no inner notifications/ sub-dir).
 * NotificationsHealthController serves /notifications/health (renamed from
 * svc-notify's HealthController at /health).
 *
 * Global wiring mirrors svc-notify app.module.ts:
 *   - AuthGuardModule + GlobalGuardsModule for JWT + RBAC guard chain
 *   - AuthorizationModule.forInstance() for centralized authz (canon §9)
 *   - ScheduleModule for the @Cron processor on NotificationService
 *   - ThrottlerModule for the per-endpoint rate limit on NotificationsController
 *
 * Migration progress (per docs/superpowers/plans/2026-05-10-platform-w1-foldins-migration.md):
 *   [x] notifications sub-module contents
 *   [x] notifications-health.controller (renamed from health.controller)
 *   [x] notifications.module final composition
 *   [ ] svc-notify app.module thin adapter
 */
@Module({
  imports: [
    AuthGuardModule,
    GlobalGuardsModule,
    AuthorizationModule.forInstance(),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ name: 'default', limit: 100, ttl: 60_000 }]),
    TypeOrmModule.forFeature([
      NotificationTemplate,
      NotificationQueue,
      NotificationHistory,
      InAppNotification,
      UserNotificationPreferences,
      InstanceEventOutbox,
      AuditLog,
      User,
    ]),
    RuntimeAnomalyModule,
  ],
  controllers: [
    NotificationsHealthController,
    NotificationTemplatesController,
    NotificationsController,
    InAppNotificationsController,
  ],
  providers: [
    NotificationService,
    InAppNotificationService,
    TemplateEngineService,
    NotificationOutboxProcessor,
    SmtpEmailProvider,
    ChannelProviderRegistry,
  ],
  exports: [
    NotificationService,
    InAppNotificationService,
    TemplateEngineService,
  ],
})
export class NotificationsModule {}
