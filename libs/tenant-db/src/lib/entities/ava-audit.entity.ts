import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * AVA Audit Trail Entity
 * Tracks all actions performed by AVA on behalf of users
 * Enables tenant admins to review and revert AI-driven changes
 */

export type AVAActionType = 'create' | 'update' | 'delete' | 'execute' | 'navigate';
export type AVAActionStatus = 'pending' | 'completed' | 'failed' | 'reverted' | 'rejected';

@Entity('ava_audit_trail')
@Index(['userId', 'createdAt'])
@Index(['actionType', 'status'])
@Index(['targetCollection', 'targetRecordId'])
export class AVAAuditTrail {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Who initiated the action
  @Column({ name: 'user_id' })
  @Index()
  userId!: string;

  @Column({ name: 'user_name', nullable: true })
  userName!: string;

  @Column({ name: 'user_role', nullable: true })
  userRole!: string;

  // Conversation context
  @Column({ name: 'conversation_id', nullable: true })
  conversationId!: string;

  @Column({ name: 'user_message', type: 'text', nullable: true })
  userMessage!: string;

  @Column({ name: 'ava_response', type: 'text', nullable: true })
  avaResponse!: string;

  // Action details
  @Column({ name: 'action_type' })
  actionType!: AVAActionType;

  @Column()
  status!: AVAActionStatus;

  @Column({ name: 'action_label' })
  actionLabel!: string;

  @Column({ name: 'action_target' })
  actionTarget!: string;

  // Target entity
  @Column({ name: 'target_collection', nullable: true })
  targetCollection!: string;

  @Column({ name: 'target_record_id', nullable: true })
  targetRecordId!: string;

  @Column({ name: 'target_display_value', nullable: true })
  targetDisplayValue!: string;

  // Data tracking for revert capability
  @Column({ name: 'before_data', type: 'jsonb', nullable: true })
  beforeData!: Record<string, unknown>;

  @Column({ name: 'after_data', type: 'jsonb', nullable: true })
  afterData!: Record<string, unknown>;

  @Column({ name: 'action_params', type: 'jsonb', nullable: true })
  actionParams!: Record<string, unknown>;

  // Revert information
  @Column({ name: 'is_revertible', default: false })
  isRevertible!: boolean;

  @Column({ name: 'reverted_at', type: 'timestamp with time zone', nullable: true })
  revertedAt!: Date;

  @Column({ name: 'reverted_by', nullable: true })
  revertedBy!: string;

  @Column({ name: 'revert_reason', nullable: true })
  revertReason!: string;

  // Failure tracking
  @Column({ name: 'error_message', nullable: true })
  errorMessage!: string;

  @Column({ name: 'error_code', nullable: true })
  errorCode!: string;

  // Permission context
  @Column({ name: 'permission_granted', default: true })
  permissionGranted!: boolean;

  @Column({ name: 'permission_rule_id', nullable: true })
  permissionRuleId!: string;

  @Column({ name: 'rejection_reason', nullable: true })
  rejectionReason!: string;

  // Metadata
  @Column({ name: 'ip_address', nullable: true })
  ipAddress!: string;

  @Column({ name: 'user_agent', nullable: true })
  userAgent!: string;

  @Column({ name: 'session_id', nullable: true })
  sessionId!: string;

  @Column({ name: 'duration_ms', nullable: true })
  durationMs!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @Column({ name: 'completed_at', type: 'timestamp with time zone', nullable: true })
  completedAt!: Date;
}

/**
 * AVA Permission Configuration Entity
 * Allows tenant admins to control what AVA can do
 */
@Entity('ava_permission_config')
@Index(['collectionCode', 'actionType'])
export class AVAPermissionConfig {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Scope of permission
  @Column({ name: 'collection_code', nullable: true })
  collectionCode!: string; // null = global setting

  @Column({ name: 'action_type' })
  actionType!: AVAActionType;

  // Permission settings
  @Column({ name: 'is_enabled', default: true })
  isEnabled!: boolean;

  @Column({ name: 'requires_confirmation', default: true })
  requiresConfirmation!: boolean;

  @Column({ name: 'allowed_roles', type: 'jsonb', default: '[]' })
  allowedRoles!: string[]; // Empty = all roles

  @Column({ name: 'excluded_roles', type: 'jsonb', default: '[]' })
  excludedRoles!: string[];

  // Restrictions
  @Column({ name: 'max_records_per_hour', nullable: true })
  maxRecordsPerHour!: number;

  @Column({ name: 'max_records_per_day', nullable: true })
  maxRecordsPerDay!: number;

  @Column({ name: 'restricted_fields', type: 'jsonb', default: '[]' })
  restrictedFields!: string[]; // Fields AVA cannot modify

  @Column({ name: 'read_only_collections', type: 'jsonb', default: '[]' })
  readOnlyCollections!: string[]; // Collections AVA cannot modify

  // Approval workflow
  @Column({ name: 'requires_approval', default: false })
  requiresApproval!: boolean;

  @Column({ name: 'approver_roles', type: 'jsonb', default: '[]' })
  approverRoles!: string[];

  // Audit requirements
  @Column({ name: 'always_audit', default: true })
  alwaysAudit!: boolean;

  @Column({ name: 'notify_admin', default: false })
  notifyAdmin!: boolean;

  // Description
  @Column({ nullable: true })
  description!: string;

  // Metadata
  @Column({ name: 'created_by', nullable: true })
  createdBy!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @Column({ name: 'updated_by', nullable: true })
  updatedBy!: string;

  @Column({ name: 'updated_at', type: 'timestamp with time zone', nullable: true })
  updatedAt!: Date;
}

/**
 * AVA Global Settings Entity
 * Tenant-wide AVA configuration
 */
@Entity('ava_global_settings')
export class AVAGlobalSettings {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Master switch
  @Column({ name: 'ava_enabled', default: true })
  avaEnabled!: boolean;

  // Default behaviors
  @Column({ name: 'default_requires_confirmation', default: true })
  defaultRequiresConfirmation!: boolean;

  @Column({ name: 'allow_create_actions', default: true })
  allowCreateActions!: boolean;

  @Column({ name: 'allow_update_actions', default: true })
  allowUpdateActions!: boolean;

  @Column({ name: 'allow_delete_actions', default: false })
  allowDeleteActions!: boolean;

  @Column({ name: 'allow_execute_actions', default: false })
  allowExecuteActions!: boolean;

  // Rate limits
  @Column({ name: 'global_rate_limit_per_hour', default: 100 })
  globalRateLimitPerHour!: number;

  @Column({ name: 'user_rate_limit_per_hour', default: 20 })
  userRateLimitPerHour!: number;

  // Audit settings
  @Column({ name: 'audit_retention_days', default: 90 })
  auditRetentionDays!: number;

  @Column({ name: 'audit_all_queries', default: false })
  auditAllQueries!: boolean; // Even read-only queries

  // Read-only mode
  @Column({ name: 'read_only_mode', default: false })
  readOnlyMode!: boolean; // AVA can only query, not modify

  // Collections that are always read-only for AVA
  @Column({ name: 'system_read_only_collections', type: 'jsonb', default: '["ava_audit_trail", "ava_permission_config", "ava_global_settings", "users", "roles", "tenants"]' })
  systemReadOnlyCollections!: string[];

  // Notification settings
  @Column({ name: 'admin_notification_email', nullable: true })
  adminNotificationEmail!: string;

  @Column({ name: 'notify_on_failure', default: true })
  notifyOnFailure!: boolean;

  @Column({ name: 'notify_on_revert', default: true })
  notifyOnRevert!: boolean;

  // Metadata
  @Column({ name: 'updated_by', nullable: true })
  updatedBy!: string;

  @Column({ name: 'updated_at', type: 'timestamp with time zone', nullable: true })
  updatedAt!: Date;
}
