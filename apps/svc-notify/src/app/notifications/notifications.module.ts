import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AuditLog,
  InAppNotification,
  InstanceEventOutbox,
  NotificationHistory,
  NotificationQueue,
  NotificationTemplate,
  UserNotificationPreferences,
} from '@hubblewave/instance-db';
import { NotificationService } from './notification.service';
import { InAppNotificationService } from './in-app-notification.service';
import { TemplateEngineService } from './template-engine.service';
import { NotificationOutboxProcessor } from './notification-outbox-processor.service';
import { NotificationTemplatesController } from './notification-templates.controller';
import { NotificationsController } from './notifications.controller';
import { InAppNotificationsController } from './in-app-notifications.controller';

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
    ]),
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
  ],
})
export class NotificationsModule {}
