// libs/instance-db/src/lib/entities/notifications.ts
//
// Notifications-area entities: notification templates, outbound queue,
// delivery history, in-app notifications, per-user notification
// preferences, and device tokens for push delivery.
//
// Public API surface is unchanged — entities continue to be exported via
// the package barrel `@hubblewave/instance-db`. This file exists to make
// area ownership explicit and to ease future code navigation. See Plan
// Fix 24 PR-A for the restructure rationale.

export {
  NotificationTemplate,
  NotificationQueue,
  NotificationHistory,
  InAppNotification,
  UserNotificationPreferences,
  DeviceToken,
} from './notification.entity';
export type {
  NotificationChannel,
  NotificationPriority,
  TemplateVariable,
  PushAction,
  InAppAction,
  NotificationQueueStatus,
  DigestFrequency,
  ChannelPreferences,
  DevicePlatform,
} from './notification.entity';
