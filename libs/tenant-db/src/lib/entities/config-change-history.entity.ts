import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/**
 * Tracks all configuration changes for audit trail and rollback functionality.
 * Supports both platform-level and tenant-level configuration changes.
 */
@Entity('config_change_history')
@Index(['tenantId', 'configType', 'resourceKey'])
@Index(['changedAt'])
@Index(['changedBy'])
export class ConfigChangeHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId?: string; // NULL for platform-level changes

  @Column({ name: 'config_type', type: 'varchar', length: 50 })
  configType!: string; // 'table', 'field', 'acl', 'workflow', 'script', 'approval', 'notification', 'event', 'business_rule'

  @Column({ name: 'resource_key', type: 'varchar', length: 255 })
  resourceKey!: string; // e.g., 'asset', 'asset.status', 'asset_read_acl'

  @Column({ name: 'change_type', type: 'varchar', length: 20 })
  changeType!: 'create' | 'update' | 'delete' | 'restore' | 'rollback';

  @Column({ name: 'previous_value', type: 'jsonb', nullable: true })
  previousValue?: Record<string, any>;

  @Column({ name: 'new_value', type: 'jsonb', nullable: true })
  newValue?: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  diff?: any[]; // JSON Patch format (RFC 6902)

  @Column({ name: 'change_reason', type: 'text', nullable: true })
  changeReason?: string; // Optional explanation from admin

  @Column({ name: 'change_source', type: 'varchar', length: 30 })
  changeSource!: 'admin_console' | 'api' | 'upgrade' | 'import' | 'migration' | 'system';

  @Column({ name: 'changed_by', type: 'uuid', nullable: true })
  changedBy?: string; // NULL for system/upgrade changes

  @CreateDateColumn({ name: 'changed_at', type: 'timestamptz' })
  changedAt!: Date;

  @Column({ name: 'is_rollbackable', type: 'boolean', default: true })
  isRollbackable!: boolean;

  @Column({ name: 'rolled_back_at', type: 'timestamptz', nullable: true })
  rolledBackAt?: Date;

  @Column({ name: 'rolled_back_by', type: 'uuid', nullable: true })
  rolledBackBy?: string;

  @Column({ name: 'rollback_to_history_id', type: 'uuid', nullable: true })
  rollbackToHistoryId?: string; // Points to which history entry was used for rollback

  @Column({ name: 'platform_version', type: 'varchar', length: 20, nullable: true })
  platformVersion?: string; // Platform version at time of change

  @Column({ name: 'correlation_id', type: 'varchar', length: 100, nullable: true })
  correlationId?: string; // For grouping related changes (e.g., bulk import)
}
