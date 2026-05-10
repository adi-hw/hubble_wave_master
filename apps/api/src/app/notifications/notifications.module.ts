import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
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
import { ChannelProviderRegistry, SmtpEmailProvider } from './channel-providers';

/**
 * NotificationsModule consolidates svc-notify into apps/api per spec §2.
 * Flattened layout: all files from svc-notify/notifications/ live directly
 * at apps/api/src/app/notifications/ (no inner notifications/ sub-dir).
 * NotificationsHealthController serves /notifications/health (renamed from
 * svc-notify's HealthController at /health).
 *
 * Global wiring (InstanceDbModule, AuthGuardModule, GlobalGuardsModule,
 * AuthorizationModule, ScheduleModule, ThrottlerModule) is inherited from the
 * root AppModule in apps/api — no duplication needed here.
 *
 * Migration progress (per docs/superpowers/plans/2026-05-10-platform-w1-foldins-migration.md):
 *   [x] notifications sub-module contents
 *   [ ] notifications-health.controller (renamed from health.controller)
 *   [ ] notifications.module final composition
 *   [ ] svc-notify app.module thin adapter
 */
@Module({
  imports: [
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
})
export class NotificationsModule {}
