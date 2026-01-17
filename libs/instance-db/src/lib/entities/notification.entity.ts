/**
 * Notification Entities
 * HubbleWave Platform - Phase 4
 *
 * Entities for notification templates, queue, history, and preferences.
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { CollectionDefinition } from './collection-definition.entity';

// ═══════════════════════════════════════════════════════════════════
// NOTIFICATION TEMPLATE
// ═══════════════════════════════════════════════════════════════════

export type NotificationChannel = 'email' | 'sms' | 'push' | 'in_app';
export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'date';
  description?: string;
  required?: boolean;
}

export interface PushAction {
  id: string;
  label: string;
  action: string;
  destructive?: boolean;
}

export interface InAppAction {
  id: string;
  label: string;
  action: string;
  variant?: 'primary' | 'secondary' | 'danger';
  icon?: string;
}

@Entity('notification_templates')
@Index(['category'], { where: '"is_active" = true' })
export class NotificationTemplate {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  code!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 100, default: 'general' })
  category!: string;

  // Email content
  @Column({ type: 'varchar', length: 500, name: 'email_subject', nullable: true })
  emailSubject?: string;

  @Column({ type: 'text', name: 'email_body_html', nullable: true })
  emailBodyHtml?: string;

  @Column({ type: 'text', name: 'email_body_text', nullable: true })
  emailBodyText?: string;

  @Column({ type: 'varchar', length: 255, name: 'email_from_name', nullable: true })
  emailFromName?: string;

  @Column({ type: 'varchar', length: 255, name: 'email_from_address', nullable: true })
  emailFromAddress?: string;

  @Column({ type: 'varchar', length: 255, name: 'email_reply_to', nullable: true })
  emailReplyTo?: string;

  // SMS content
  @Column({ type: 'varchar', length: 320, name: 'sms_body', nullable: true })
  smsBody?: string;

  // Push content
  @Column({ type: 'varchar', length: 255, name: 'push_title', nullable: true })
  pushTitle?: string;

  @Column({ type: 'varchar', length: 500, name: 'push_body', nullable: true })
  pushBody?: string;

  @Column({ type: 'varchar', length: 255, name: 'push_icon', nullable: true })
  pushIcon?: string;

  @Column({ type: 'jsonb', name: 'push_actions', nullable: true })
  pushActions?: PushAction[];

  // In-app content
  @Column({ type: 'varchar', length: 255, name: 'in_app_title', nullable: true })
  inAppTitle?: string;

  @Column({ type: 'text', name: 'in_app_body', nullable: true })
  inAppBody?: string;

  @Column({ type: 'varchar', length: 100, name: 'in_app_icon', nullable: true })
  inAppIcon?: string;

  @Column({ type: 'varchar', length: 20, name: 'in_app_priority', default: 'medium' })
  inAppPriority!: NotificationPriority;

  @Column({ type: 'jsonb', name: 'in_app_actions', nullable: true })
  inAppActions?: InAppAction[];

  @Column({ type: 'varchar', length: 500, name: 'in_app_deep_link', nullable: true })
  inAppDeepLink?: string;

  // Template metadata
  @Column({ type: 'jsonb', default: [] })
  variables!: TemplateVariable[];

  @Column({ type: 'jsonb', name: 'supported_channels', default: ['email', 'in_app'] })
  supportedChannels!: NotificationChannel[];

  @Column({ type: 'boolean', name: 'is_system', default: false })
  isSystem!: boolean;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ type: 'uuid', name: 'created_by', nullable: true })
  createdBy?: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @Column({ type: 'uuid', name: 'updated_by', nullable: true })
  updatedBy?: string;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}

// ═══════════════════════════════════════════════════════════════════
// NOTIFICATION QUEUE
// ═══════════════════════════════════════════════════════════════════

export type NotificationQueueStatus = 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled';

@Entity('notification_queue')
@Index(['status', 'scheduledFor'])
@Index(['recipientId'])
export class NotificationQueue {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'template_id', nullable: true })
  templateId?: string;

  @ManyToOne(() => NotificationTemplate, { nullable: true })
  @JoinColumn({ name: 'template_id' })
  template?: NotificationTemplate;

  @Column({ type: 'uuid', name: 'recipient_id' })
  recipientId!: string;

  @Column({ type: 'jsonb' })
  channels!: NotificationChannel[];

  @Column({ type: 'jsonb', default: {} })
  context!: Record<string, unknown>;

  @Column({ type: 'timestamptz', name: 'scheduled_for', nullable: true })
  scheduledFor?: Date;

  @Column({ type: 'varchar', length: 20, default: 'medium' })
  priority!: NotificationPriority;

  @Column({ type: 'varchar', length: 50, default: 'pending' })
  status!: NotificationQueueStatus;

  @Column({ type: 'integer', default: 0 })
  attempts!: number;

  @Column({ type: 'integer', name: 'max_attempts', default: 3 })
  maxAttempts!: number;

  @Column({ type: 'text', name: 'last_error', nullable: true })
  lastError?: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @Column({ type: 'timestamptz', name: 'processed_at', nullable: true })
  processedAt?: Date;

  @OneToMany(() => NotificationHistory, (history) => history.notificationQueue)
  history?: NotificationHistory[];
}

// ═══════════════════════════════════════════════════════════════════
// NOTIFICATION HISTORY
// ═══════════════════════════════════════════════════════════════════

@Entity('notification_history')
@Index(['notificationQueueId'])
@Index(['recipientId', 'sentAt'])
export class NotificationHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'notification_queue_id', nullable: true })
  notificationQueueId?: string;

  @ManyToOne(() => NotificationQueue, (queue) => queue.history, { nullable: true })
  @JoinColumn({ name: 'notification_queue_id' })
  notificationQueue?: NotificationQueue;

  @Column({ type: 'varchar', length: 20 })
  channel!: NotificationChannel;

  @Column({ type: 'uuid', name: 'recipient_id' })
  recipientId!: string;

  @Column({ type: 'timestamptz', name: 'sent_at', nullable: true })
  sentAt?: Date;

  @Column({ type: 'timestamptz', name: 'delivered_at', nullable: true })
  deliveredAt?: Date;

  @Column({ type: 'timestamptz', name: 'opened_at', nullable: true })
  openedAt?: Date;

  @Column({ type: 'timestamptz', name: 'clicked_at', nullable: true })
  clickedAt?: Date;

  @Column({ type: 'timestamptz', name: 'failed_at', nullable: true })
  failedAt?: Date;

  @Column({ type: 'text', name: 'error_message', nullable: true })
  errorMessage?: string;

  @Column({ type: 'varchar', length: 255, name: 'provider_id', nullable: true })
  providerId?: string;

  @Column({ type: 'jsonb', name: 'provider_response', nullable: true })
  providerResponse?: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}

// ═══════════════════════════════════════════════════════════════════
// IN-APP NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════

@Entity('in_app_notifications')
@Index(['userId', 'read', 'createdAt'])
@Index(['userId'], { where: '"read" = false AND "dismissed" = false' })
export class InAppNotification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text' })
  body!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  icon?: string;

  @Column({ type: 'varchar', length: 20, default: 'medium' })
  priority!: NotificationPriority;

  @Column({ type: 'jsonb', nullable: true })
  actions?: InAppAction[];

  @Column({ type: 'varchar', length: 500, name: 'deep_link', nullable: true })
  deepLink?: string;

  @Column({ type: 'uuid', name: 'record_id', nullable: true })
  recordId?: string;

  @Column({ type: 'uuid', name: 'collection_id', nullable: true })
  collectionId?: string;

  @ManyToOne(() => CollectionDefinition, { nullable: true })
  @JoinColumn({ name: 'collection_id' })
  collection?: CollectionDefinition;

  @Column({ type: 'boolean', default: false })
  read!: boolean;

  @Column({ type: 'timestamptz', name: 'read_at', nullable: true })
  readAt?: Date;

  @Column({ type: 'boolean', default: false })
  dismissed!: boolean;

  @Column({ type: 'timestamptz', name: 'dismissed_at', nullable: true })
  dismissedAt?: Date;

  @Column({ type: 'timestamptz', name: 'expires_at', nullable: true })
  expiresAt?: Date;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}

// ═══════════════════════════════════════════════════════════════════
// USER NOTIFICATION PREFERENCES
// ═══════════════════════════════════════════════════════════════════

export type DigestFrequency = 'daily' | 'weekly';

export interface ChannelPreferences {
  [category: string]: NotificationChannel[];
}

@Entity('user_notification_preferences')
export class UserNotificationPreferences {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'user_id', unique: true })
  userId!: string;

  @Column({ type: 'jsonb', default: {} })
  preferences!: ChannelPreferences;

  @Column({ type: 'boolean', name: 'quiet_hours_enabled', default: false })
  quietHoursEnabled!: boolean;

  @Column({ type: 'time', name: 'quiet_hours_start', nullable: true })
  quietHoursStart?: string;

  @Column({ type: 'time', name: 'quiet_hours_end', nullable: true })
  quietHoursEnd?: string;

  @Column({ type: 'varchar', length: 50, name: 'quiet_hours_timezone', default: 'UTC' })
  quietHoursTimezone!: string;

  @Column({ type: 'boolean', name: 'digest_mode', default: false })
  digestMode!: boolean;

  @Column({ type: 'varchar', length: 20, name: 'digest_frequency', default: 'daily' })
  digestFrequency!: DigestFrequency;

  @Column({ type: 'time', name: 'digest_time', default: '08:00' })
  digestTime!: string;

  @Column({ type: 'boolean', name: 'email_enabled', default: true })
  emailEnabled!: boolean;

  @Column({ type: 'boolean', name: 'sms_enabled', default: true })
  smsEnabled!: boolean;

  @Column({ type: 'boolean', name: 'push_enabled', default: true })
  pushEnabled!: boolean;

  @Column({ type: 'boolean', name: 'in_app_enabled', default: true })
  inAppEnabled!: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}

// ═══════════════════════════════════════════════════════════════════
// DEVICE TOKENS
// ═══════════════════════════════════════════════════════════════════

export type DevicePlatform = 'ios' | 'android' | 'web';

@Entity('device_tokens')
@Index(['userId'], { where: '"is_active" = true' })
export class DeviceToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'text', unique: true })
  token!: string;

  @Column({ type: 'varchar', length: 20 })
  platform!: DevicePlatform;

  @Column({ type: 'varchar', length: 255, name: 'device_name', nullable: true })
  deviceName?: string;

  @Column({ type: 'varchar', length: 100, name: 'device_model', nullable: true })
  deviceModel?: string;

  @Column({ type: 'varchar', length: 50, name: 'os_version', nullable: true })
  osVersion?: string;

  @Column({ type: 'varchar', length: 50, name: 'app_version', nullable: true })
  appVersion?: string;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ type: 'timestamptz', name: 'last_used_at', nullable: true })
  lastUsedAt?: Date;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
