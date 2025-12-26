import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

// ============================================================
// AVA (AI Virtual Assistant) Entities
// ============================================================

export type AVAActionType = 'navigate' | 'create' | 'update' | 'delete' | 'execute';
export type AVAActionStatus = 'pending' | 'confirmed' | 'completed' | 'failed' | 'reverted' | 'cancelled';

/**
 * AVA Audit Trail - Records all actions performed by AVA
 */
@Entity('ava_audit_trail')
@Index(['userId'])
@Index(['actionType'])
@Index(['status'])
@Index(['targetCollection'])
@Index(['createdAt'])
export class AVAAuditTrail {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'user_name', nullable: true })
  userName?: string;

  @Column({ name: 'user_role', nullable: true })
  userRole?: string;

  @Column({ name: 'conversation_id', type: 'uuid', nullable: true })
  conversationId?: string;

  @Column({ name: 'user_message', type: 'text', nullable: true })
  userMessage?: string;

  @Column({ name: 'ava_response', type: 'text', nullable: true })
  avaResponse?: string;

  @Column({ name: 'action_type', type: 'varchar', length: 50 })
  actionType!: AVAActionType;

  @Column({ type: 'varchar', length: 50, default: 'pending' })
  status!: AVAActionStatus;

  @Column({ name: 'action_label', nullable: true })
  actionLabel?: string;

  @Column({ name: 'action_target', nullable: true })
  actionTarget?: string;

  @Column({ name: 'target_collection', nullable: true })
  targetCollection?: string;

  @Column({ name: 'target_record_id', type: 'uuid', nullable: true })
  targetRecordId?: string;

  @Column({ name: 'target_display_value', nullable: true })
  targetDisplayValue?: string;

  @Column({ name: 'before_data', type: 'jsonb', nullable: true })
  beforeData?: Record<string, unknown>;

  @Column({ name: 'after_data', type: 'jsonb', nullable: true })
  afterData?: Record<string, unknown>;

  @Column({ name: 'action_params', type: 'jsonb', nullable: true })
  actionParams?: Record<string, unknown>;

  @Column({ name: 'is_revertible', default: false })
  isRevertible!: boolean;

  @Column({ name: 'ip_address', nullable: true })
  ipAddress?: string;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent?: string;

  @Column({ name: 'session_id', type: 'uuid', nullable: true })
  sessionId?: string;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ name: 'error_code', nullable: true })
  errorCode?: string;

  @Column({ name: 'duration_ms', nullable: true })
  durationMs?: number;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt?: Date;

  @Column({ name: 'reverted_at', type: 'timestamptz', nullable: true })
  revertedAt?: Date;

  @Column({ name: 'reverted_by', type: 'uuid', nullable: true })
  revertedBy?: string;

  @Column({ name: 'revert_reason', type: 'text', nullable: true })
  revertReason?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

/**
 * AVA Permission Configuration
 */
@Entity('ava_permission_configs')
@Index(['collectionCode', 'actionType'], { unique: true })
export class AVAPermissionConfig {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'collection_code', nullable: true })
  collectionCode?: string;

  @Column({ name: 'action_type', type: 'varchar', length: 50 })
  actionType!: AVAActionType;

  @Column({ name: 'is_enabled', default: true })
  isEnabled!: boolean;

  @Column({ name: 'requires_confirmation', default: true })
  requiresConfirmation!: boolean;

  @Column({ name: 'allowed_roles', type: 'jsonb', default: () => `'[]'` })
  allowedRoles!: string[];

  @Column({ name: 'excluded_roles', type: 'jsonb', default: () => `'[]'` })
  excludedRoles!: string[];

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

/**
 * AVA Global Settings
 */
@Entity('ava_global_settings')
export class AVAGlobalSettings {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'ava_enabled', default: true })
  avaEnabled!: boolean;

  @Column({ name: 'read_only_mode', default: false })
  readOnlyMode!: boolean;

  @Column({ name: 'allow_create_actions', default: true })
  allowCreateActions!: boolean;

  @Column({ name: 'allow_update_actions', default: true })
  allowUpdateActions!: boolean;

  @Column({ name: 'allow_delete_actions', default: false })
  allowDeleteActions!: boolean;

  @Column({ name: 'allow_execute_actions', default: true })
  allowExecuteActions!: boolean;

  @Column({ name: 'default_requires_confirmation', default: true })
  defaultRequiresConfirmation!: boolean;

  @Column({ name: 'system_read_only_collections', type: 'jsonb', default: () => `'[]'` })
  systemReadOnlyCollections!: string[];

  @Column({ name: 'user_rate_limit_per_hour', default: 100 })
  userRateLimitPerHour!: number;

  @Column({ name: 'global_rate_limit_per_hour', default: 10000 })
  globalRateLimitPerHour!: number;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy?: string;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
