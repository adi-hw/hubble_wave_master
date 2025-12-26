import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { User } from './user.entity';
import { Role } from './role.entity';
import { Group } from './group.entity';

export interface NavItemVisibility {
  rolesAny?: string[];
  rolesAll?: string[];
  permissionsAny?: string[];
  featureFlagsAny?: string[];
  expression?: string;
}

export interface ModuleSecurity {
  featureFlag?: string;
}

// ============================================================
// AUTH SETTINGS ENTITY
// ============================================================

/**
 * AuthSettings entity - instance-level authentication configuration
 */
@Entity('auth_settings')
export class AuthSettings {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // ─────────────────────────────────────────────────────────────────
  // Password Policy
  // ─────────────────────────────────────────────────────────────────

  @Column({ name: 'password_min_length', type: 'integer', default: 12 })
  passwordMinLength!: number;

  @Column({ name: 'password_require_uppercase', type: 'boolean', default: true })
  passwordRequireUppercase!: boolean;

  @Column({ name: 'password_require_lowercase', type: 'boolean', default: true })
  passwordRequireLowercase!: boolean;

  @Column({ name: 'password_require_numbers', type: 'boolean', default: true })
  passwordRequireNumbers!: boolean;

  @Column({ name: 'password_require_symbols', type: 'boolean', default: true })
  passwordRequireSymbols!: boolean;

  @Column({ name: 'password_history_count', type: 'integer', default: 12 })
  passwordHistoryCount!: number;

  @Column({ name: 'password_expiry_days', type: 'integer', default: 90 })
  passwordExpiryDays!: number;

  @Column({ name: 'password_block_common', type: 'boolean', default: true })
  passwordBlockCommon!: boolean;

  // ─────────────────────────────────────────────────────────────────
  // Lockout Policy
  // ─────────────────────────────────────────────────────────────────

  @Column({ name: 'max_failed_attempts', type: 'integer', default: 5 })
  maxFailedAttempts!: number;

  @Column({ name: 'lockout_duration_minutes', type: 'integer', default: 30 })
  lockoutDurationMinutes!: number;

  // ─────────────────────────────────────────────────────────────────
  // Session Policy
  // ─────────────────────────────────────────────────────────────────

  @Column({ name: 'session_timeout_minutes', type: 'integer', default: 480 })
  sessionTimeoutMinutes!: number;

  @Column({ name: 'max_concurrent_sessions', type: 'integer', default: 5 })
  maxConcurrentSessions!: number;

  @Column({ name: 'remember_me_duration_days', type: 'integer', default: 30 })
  rememberMeDurationDays!: number;

  // ─────────────────────────────────────────────────────────────────
  // MFA Policy
  // ─────────────────────────────────────────────────────────────────

  @Column({ name: 'mfa_required', type: 'boolean', default: false })
  mfaRequired!: boolean;

  @Column({ name: 'mfa_grace_period_days', type: 'integer', default: 7 })
  mfaGracePeriodDays!: number;

  // ─────────────────────────────────────────────────────────────────
  // SSO Settings
  // ─────────────────────────────────────────────────────────────────

  @Column({ name: 'sso_enabled', type: 'boolean', default: false })
  ssoEnabled!: boolean;

  @Column({ name: 'sso_enforce', type: 'boolean', default: false })
  ssoEnforce!: boolean;

  @Column({ name: 'sso_config', type: 'jsonb', nullable: true })
  ssoConfig?: Record<string, unknown> | null;

  // ─────────────────────────────────────────────────────────────────
  // IP Whitelist
  // ─────────────────────────────────────────────────────────────────

  @Column({ name: 'ip_whitelist_enabled', type: 'boolean', default: false })
  ipWhitelistEnabled!: boolean;

  @Column({ name: 'ip_whitelist', type: 'jsonb', default: () => `'[]'` })
  ipWhitelist!: string[];

  // ─────────────────────────────────────────────────────────────────
  // Allowed Auth Methods
  // ─────────────────────────────────────────────────────────────────

  @Column({ name: 'allowed_auth_methods', type: 'jsonb', default: () => `'["password", "sso", "ldap"]'` })
  allowedAuthMethods!: string[];

  // ─────────────────────────────────────────────────────────────────
  // Self-Service Options
  // ─────────────────────────────────────────────────────────────────

  @Column({ name: 'allow_password_reset', type: 'boolean', default: true })
  allowPasswordReset!: boolean;

  @Column({ name: 'allow_profile_edit', type: 'boolean', default: true })
  allowProfileEdit!: boolean;

  @Column({ name: 'allow_mfa_self_enrollment', type: 'boolean', default: true })
  allowMfaSelfEnrollment!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

// ============================================================
// AUTH EVENT ENTITY
// ============================================================

/**
 * AuthEvent entity - audit log for authentication events
 */
@Entity('auth_events')
@Index(['userId'])
@Index(['eventType'])
@Index(['createdAt'])
export class AuthEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** User (if applicable) */
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user?: User | null;

  /** Event type */
  @Column({ name: 'event_type', type: 'varchar', length: 50 })
  eventType!: string;

  /** Success or failure */
  @Column({ type: 'boolean' })
  success!: boolean;

  /** IP address */
  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress?: string | null;

  /** User agent */
  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent?: string | null;

  /** Geo location */
  @Column({ name: 'geo_location', type: 'jsonb', nullable: true })
  geoLocation?: Record<string, unknown> | null;

  /** Additional details */
  @Column({ type: 'jsonb', default: () => `'{}'` })
  details!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

// ============================================================
// AUDIT LOG ENTITY
// ============================================================

/**
 * AuditLog entity - general audit log for all operations
 */
@Entity('audit_logs')
@Index(['userId'])
@Index(['collectionCode'])
@Index(['recordId'])
@Index(['action'])
@Index(['createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** User who performed the action */
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user?: User | null;

  /** Collection affected */
  @Column({ name: 'collection_code', type: 'varchar', length: 100, nullable: true })
  collectionCode?: string | null;

  /** Record ID affected */
  @Column({ name: 'record_id', type: 'uuid', nullable: true })
  recordId?: string | null;

  /** Action performed */
  @Column({ type: 'varchar', length: 50 })
  action!: string;

  /** Old values (for updates) */
  @Column({ name: 'old_values', type: 'jsonb', nullable: true })
  oldValues?: Record<string, unknown> | null;

  /** New values (for creates/updates) */
  @Column({ name: 'new_values', type: 'jsonb', nullable: true })
  newValues?: Record<string, unknown> | null;

  /** IP address */
  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress?: string | null;

  /** User agent */
  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

// ============================================================
// NAV PROFILE ENTITY
// ============================================================

/**
 * NavProfile entity - navigation profile definitions
 * 
 * NOTE: This is NOT "tenant_nav_profiles" - we don't use tenant terminology!
 */
@Entity('nav_profiles')
@Index(['code'], { unique: true })
@Index(['scope'])
@Index(['isDefault'])
export class NavProfile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Unique profile code */
  @Column({ type: 'varchar', length: 100, unique: true })
  code!: string;

  /** Display name */
  @Column({ type: 'varchar', length: 255 })
  name!: string;

  /** Description */
  @Column({ type: 'text', nullable: true })
  description?: string | null;

  // ─────────────────────────────────────────────────────────────────
  // Scope
  // ─────────────────────────────────────────────────────────────────

  /** Scope (role, group, user) */
  @Column({ type: 'varchar', length: 50, default: 'role' })
  scope!: string;

  /** Role this profile applies to */
  @Column({ name: 'role_id', type: 'uuid', nullable: true })
  roleId?: string | null;

  @ManyToOne(() => Role, { nullable: true })
  @JoinColumn({ name: 'role_id' })
  role?: Role | null;

  /** Group this profile applies to */
  @Column({ name: 'group_id', type: 'uuid', nullable: true })
  groupId?: string | null;

  @ManyToOne(() => Group, { nullable: true })
  @JoinColumn({ name: 'group_id' })
  group?: Group | null;

  /** User this profile applies to */
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user?: User | null;

  /** Priority (lower = higher priority) */
  @Column({ type: 'integer', default: 100 })
  priority!: number;

  // ─────────────────────────────────────────────────────────────────
  // Automation & Templates
  // ─────────────────────────────────────────────────────────────────

  @Column({ name: 'template_key', type: 'varchar', length: 100, nullable: true })
  templateKey?: string | null;

  @Column({ name: 'auto_assign_roles', type: 'simple-array', nullable: true })
  autoAssignRoles?: string[] | null;

  @Column({ name: 'auto_assign_expression', type: 'text', nullable: true })
  autoAssignExpression?: string | null;

  // ─────────────────────────────────────────────────────────────────
  // Flags
  // ─────────────────────────────────────────────────────────────────

  /** Is locked (cannot be edited) */
  @Column({ name: 'is_locked', type: 'boolean', default: false })
  isLocked!: boolean;

  /** Is default view for this collection */
  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault!: boolean;

  /** System view (cannot be deleted) */
  @Column({ name: 'is_system', type: 'boolean', default: false })
  isSystem!: boolean;

  /** Active status */
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  // ─────────────────────────────────────────────────────────────────
  // Relations
  // ─────────────────────────────────────────────────────────────────

  @OneToMany(() => NavProfileItem, (item) => item.profile)
  items?: NavProfileItem[];

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

// ============================================================
// NAV PROFILE ITEM ENTITY
// ============================================================

/**
 * NavProfileItem entity - items in a navigation profile
 * 
 * NOTE: This is NOT "tenant_nav_profile_items" - we don't use tenant terminology!
 */
@Entity('nav_profile_items')
@Index(['profileId'])
@Index(['parentId'])
export class NavProfileItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Profile this item belongs to */
  @Column({ name: 'profile_id', type: 'uuid' })
  profileId!: string;

  @ManyToOne(() => NavProfile, (profile) => profile.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'profile_id' })
  profile?: NavProfile;

  /** Item type */
  @Column({ type: 'varchar', length: 50 })
  type!: string;

  /** Item code */
  @Column({ type: 'varchar', length: 100 })
  code!: string;

  /** Display label */
  @Column({ type: 'varchar', length: 255 })
  label!: string;

  /** Icon */
  @Column({ type: 'varchar', length: 100, nullable: true })
  icon?: string | null;

  /** Route path */
  @Column({ type: 'varchar', length: 500, nullable: true })
  route?: string | null;

  /** External URL */
  @Column({ name: 'external_url', type: 'varchar', length: 500, nullable: true })
  externalUrl?: string | null;

  /** Parent item */
  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId?: string | null;

  @ManyToOne(() => NavProfileItem, { nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent?: NavProfileItem | null;

  /** Display order */
  @Column({ type: 'integer', default: 0 })
  position!: number;

  /** Visibility expression */
  @Column({ name: 'visibility_expression', type: 'text', nullable: true })
  visibilityExpression?: string | null;

  /** Required permission */
  @Column({ name: 'required_permission', type: 'varchar', length: 100, nullable: true })
  requiredPermission?: string | null;

  @Column({ name: 'is_visible', type: 'boolean', default: true })
  isVisible!: boolean;

  @Column({ name: 'is_expanded', type: 'boolean', default: false })
  isExpanded!: boolean;

  @Column({ type: 'jsonb', default: () => `'{}'` })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

// ============================================================
// INSTANCE SETTINGS ENTITY
// ============================================================

/**
 * InstanceSettings entity - instance-level configuration
 * 
 * NOTE: This is NOT "tenant_settings" - we don't use tenant terminology!
 */
@Entity('instance_settings')
@Index(['category'])
@Index(['key'], { unique: true })
export class InstanceSetting {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Setting category */
  @Column({ type: 'varchar', length: 100 })
  category!: string;

  /** Setting key */
  @Column({ type: 'varchar', length: 100, unique: true })
  key!: string;

  /** Setting value */
  @Column({ type: 'jsonb' })
  value!: unknown;

  /** Description */
  @Column({ type: 'text', nullable: true })
  description?: string | null;

  /** Is system setting (cannot be deleted) */
  @Column({ name: 'is_system', type: 'boolean', default: false })
  isSystem!: boolean;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
