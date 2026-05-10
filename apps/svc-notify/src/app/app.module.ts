import { Module } from '@nestjs/common';
import { NotificationsModule } from '../../../api/src/app/notifications/notifications.module';

/**
 * Thin adapter module. All logic has migrated to NotificationsModule in apps/api
 * per the ARC-W1 fold-ins plan. This module exists solely so svc-notify
 * continues to boot during the service cutover window.
 */
@Module({
  imports: [NotificationsModule],
})
export class AppModule {}
