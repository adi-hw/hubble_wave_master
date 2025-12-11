import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export type NotificationLinkType = 'record' | 'approval' | 'workflow' | 'external';
export type InAppNotificationType = 'approval' | 'assignment' | 'mention' | 'system' | 'workflow' | 'alert';

@Entity('in_app_notification')
@Index(['userId', 'isRead', 'createdAt'])
@Index(['tenantId', 'userId'])
export class InAppNotification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  message?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  icon?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  color?: string;

  @Column({ name: 'link_type', type: 'varchar', length: 30, nullable: true })
  linkType?: NotificationLinkType;

  @Column({ name: 'link_table', type: 'varchar', length: 100, nullable: true })
  linkTable?: string;

  @Column({ name: 'link_record_id', type: 'uuid', nullable: true })
  linkRecordId?: string;

  @Column({ name: 'link_url', type: 'varchar', length: 500, nullable: true })
  linkUrl?: string;

  @Column({ name: 'is_read', type: 'boolean', default: false })
  isRead!: boolean;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt?: Date;

  @Column({ name: 'is_archived', type: 'boolean', default: false })
  isArchived!: boolean;

  @Column({ name: 'archived_at', type: 'timestamptz', nullable: true })
  archivedAt?: Date;

  @Column({ name: 'group_key', type: 'varchar', length: 100, nullable: true })
  groupKey?: string;

  @Column({ name: 'notification_type', type: 'varchar', length: 50, nullable: true })
  notificationType?: InAppNotificationType;

  @Column({ name: 'source_type', type: 'varchar', length: 30, nullable: true })
  sourceType?: string;

  @Column({ name: 'source_id', type: 'uuid', nullable: true })
  sourceId?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt?: Date;
}
