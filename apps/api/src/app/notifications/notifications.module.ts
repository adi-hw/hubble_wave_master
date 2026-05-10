import { Module } from '@nestjs/common';

/**
 * NotificationsModule consolidates svc-notify into apps/api per spec §2.
 *
 * Migration progress (per docs/superpowers/plans/2026-05-10-platform-w1-foldins-migration.md):
 *   [ ] notifications sub-module contents
 *   [ ] notifications-health.controller (renamed from health.controller)
 *   [ ] notifications.module final composition
 *   [ ] svc-notify app.module thin adapter
 */
@Module({
  imports: [],
  controllers: [],
  providers: [],
  exports: [],
})
export class NotificationsModule {}
