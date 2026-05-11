import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Role } from './role.entity';
import { Group } from './group.entity';
import { CollectionDefinition } from './collection-definition.entity';
import { PropertyDefinition } from './property-definition.entity';

// ============================================================
// COLLECTION ACCESS RULE ENTITY
// ============================================================

/**
 * CollectionAccessRule entity - defines row-level access rules
 * 
 * NOTE: This is NOT "tenant_collection_acls" - we don't use tenant terminology!
 */
@Entity('collection_access_rules')
@Index(['collectionId'])
@Index(['collectionId', 'ruleKey'])
@Index(['roleId'])
@Index(['groupId'])
@Index(['userId'])
@Index(['priority'])
export class CollectionAccessRule {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Collection this rule applies to */
  @Column({ name: 'collection_id', type: 'uuid' })
  collectionId!: string;

  @ManyToOne(() => CollectionDefinition, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'collection_id' })
  collection?: CollectionDefinition;

  // ─────────────────────────────────────────────────────────────────
  // Identity
  // ─────────────────────────────────────────────────────────────────

  /** Rule name */
  @Column({ type: 'varchar', length: 255 })
  name!: string;

  /** Description */
  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ name: 'rule_key', type: 'varchar', length: 120, nullable: true })
  ruleKey?: string | null;

  @Column({ type: 'jsonb', default: () => `'{}'` })
  metadata!: Record<string, unknown>;

  // ─────────────────────────────────────────────────────────────────
  // Scope (who does this rule apply to)
  // ─────────────────────────────────────────────────────────────────

  /** Apply to specific role */
  @Column({ name: 'role_id', type: 'uuid', nullable: true })
  roleId?: string | null;

  @ManyToOne(() => Role, { nullable: true })
  @JoinColumn({ name: 'role_id' })
  role?: Role | null;

  /** Apply to specific group */
  @Column({ name: 'group_id', type: 'uuid', nullable: true })
  groupId?: string | null;

  @ManyToOne(() => Group, { nullable: true })
  @JoinColumn({ name: 'group_id' })
  group?: Group | null;

  /** Apply to specific user */
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user?: User | null;

  // ─────────────────────────────────────────────────────────────────
  // Operations
  // ─────────────────────────────────────────────────────────────────

  @Column({ name: 'can_read', type: 'boolean', default: false })
  canRead!: boolean;

  @Column({ name: 'can_create', type: 'boolean', default: false })
  canCreate!: boolean;

  @Column({ name: 'can_update', type: 'boolean', default: false })
  canUpdate!: boolean;

  @Column({ name: 'can_delete', type: 'boolean', default: false })
  canDelete!: boolean;

  /**
   * Rule effect — canon §28.2/§28.3.
   *
   * `allow` rules contribute positive grants (UNION across matching rules);
   * `deny` rules subtract from the visible set (INTERSECT — any matching
   * deny on a record/field denies it regardless of co-matching allows).
   *
   * Migration `1930100000000-add-rule-effect.ts` defaults legacy rows to
   * `'allow'` and enforces the closed set via a CHECK constraint.
   */
  @Column({ type: 'varchar', length: 10, default: 'allow' })
  effect!: 'allow' | 'deny';

  // ─────────────────────────────────────────────────────────────────
  // Conditions (row-level filtering)
  // ─────────────────────────────────────────────────────────────────

  /** Conditions for when this rule applies */
  @Column({ type: 'jsonb', nullable: true })
  conditions?: Record<string, unknown> | null;

  // ─────────────────────────────────────────────────────────────────
  // Priority
  // ─────────────────────────────────────────────────────────────────

  /** Priority (lower = evaluated first) */
  @Column({ type: 'integer', default: 100 })
  priority!: number;

  // ─────────────────────────────────────────────────────────────────
  // Flags
  // ─────────────────────────────────────────────────────────────────

  /** Active status */
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  // ─────────────────────────────────────────────────────────────────
  // Audit Fields
  // ─────────────────────────────────────────────────────────────────

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdByUser?: User | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

// ============================================================
// PROPERTY ACCESS RULE ENTITY
// ============================================================

/**
 * PropertyAccessRule entity - defines field-level access rules
 * 
 * NOTE: This is NOT "tenant_property_acls" - we don't use tenant terminology!
 */
@Entity('property_access_rules')
@Index(['propertyId'])
@Index(['propertyId', 'ruleKey'])
@Index(['roleId'])
@Index(['groupId'])
@Index(['userId'])
@Index('IDX_property_access_rules_wildcard_collection_id', ['wildcardCollectionId'])
export class PropertyAccessRule {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * Property this rule applies to (explicit-field rule, canon §28.2 levels 1-2).
   *
   * Nullable since migration 1930200000000-add-property-access-rule-wildcards.ts
   * (wildcard field rules). A NULL `property_id` indicates a wildcard rule —
   * see `wildcardCollectionId` below. The DB CHECK constraint
   * `CHK_property_access_rules_target_xor` enforces that exactly one of
   * (`property_id`, `wildcard_collection_id`) is NOT NULL.
   */
  @Column({ name: 'property_id', type: 'uuid', nullable: true })
  propertyId?: string | null;

  @ManyToOne(() => PropertyDefinition, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'property_id' })
  property?: PropertyDefinition | null;

  /**
   * Collection this wildcard rule applies to (wildcard field rule, canon
   * §28.2 levels 3-4). When set, the rule applies to EVERY field of the
   * referenced collection — distinct from a collection-level rule, which
   * gates record visibility. Wildcard field rules gate field visibility
   * at a level above the collection-rule fallback and below explicit
   * field rules.
   *
   * Mutually exclusive with `propertyId` per the XOR CHECK constraint.
   * Added by migration 1930200000000-add-property-access-rule-wildcards.ts.
   */
  @Column({ name: 'wildcard_collection_id', type: 'uuid', nullable: true })
  wildcardCollectionId?: string | null;

  @ManyToOne(() => CollectionDefinition, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'wildcard_collection_id' })
  wildcardCollection?: CollectionDefinition | null;

  // ─────────────────────────────────────────────────────────────────
  // Scope (who does this rule apply to)
  // ─────────────────────────────────────────────────────────────────

  /** Apply to specific role */
  @Column({ name: 'role_id', type: 'uuid', nullable: true })
  roleId?: string | null;

  @ManyToOne(() => Role, { nullable: true })
  @JoinColumn({ name: 'role_id' })
  role?: Role | null;

  /** Apply to specific group */
  @Column({ name: 'group_id', type: 'uuid', nullable: true })
  groupId?: string | null;

  @ManyToOne(() => Group, { nullable: true })
  @JoinColumn({ name: 'group_id' })
  group?: Group | null;

  /** Apply to specific user */
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user?: User | null;

  // ─────────────────────────────────────────────────────────────────
  // Permissions
  // ─────────────────────────────────────────────────────────────────

  @Column({ name: 'can_read', type: 'boolean', default: true })
  canRead!: boolean;

  @Column({ name: 'can_write', type: 'boolean', default: true })
  canWrite!: boolean;

  @Column({ name: 'masking_strategy', type: 'varchar', length: 20, default: 'NONE' })
  maskingStrategy!: 'NONE' | 'PARTIAL' | 'FULL';

  /**
   * Rule effect — canon §28.2.
   *
   * `allow` rules grant read/write (subject to masking); `deny` rules force
   * `canRead=false, canWrite=false` and treat the field as fully redacted at
   * the §28.2 level-1 step regardless of any co-matching allow.
   *
   * Migration `1930100000000-add-rule-effect.ts` defaults legacy rows to
   * `'allow'` and enforces the closed set via a CHECK constraint.
   */
  @Column({ type: 'varchar', length: 10, default: 'allow' })
  effect!: 'allow' | 'deny';

  // ─────────────────────────────────────────────────────────────────
  // Conditions
  // ─────────────────────────────────────────────────────────────────

  /** Conditions for when this rule applies */
  @Column({ type: 'jsonb', nullable: true })
  conditions?: Record<string, unknown> | null;

  // ─────────────────────────────────────────────────────────────────
  // Priority
  // ─────────────────────────────────────────────────────────────────

  /** Priority (lower = evaluated first) */
  @Column({ type: 'integer', default: 100 })
  priority!: number;

  // ─────────────────────────────────────────────────────────────────
  // Flags
  // ─────────────────────────────────────────────────────────────────

  /** Active status */
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'rule_key', type: 'varchar', length: 120, nullable: true })
  ruleKey?: string | null;

  @Column({ type: 'jsonb', default: () => `'{}'` })
  metadata!: Record<string, unknown>;
}

// ============================================================
// USER SESSION ENTITY
// ============================================================

/**
 * UserSession entity - tracks user sessions
 */
@Entity('user_sessions')
@Index(['userId'])
@Index(['sessionToken'], { unique: true })
@Index(['expiresAt'])
@Index(['isActive'])
export class UserSession {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** User this session belongs to */
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  // ─────────────────────────────────────────────────────────────────
  // Session Info
  // ─────────────────────────────────────────────────────────────────

  /** Session token */
  @Column({ name: 'session_token', type: 'varchar', length: 500, unique: true })
  sessionToken!: string;

  /** Refresh token */
  @Column({ name: 'refresh_token', type: 'varchar', length: 500, nullable: true })
  refreshToken?: string | null;

  // ─────────────────────────────────────────────────────────────────
  // Device Info
  // ─────────────────────────────────────────────────────────────────

  /** Device ID */
  @Column({ name: 'device_id', type: 'varchar', length: 255, nullable: true })
  deviceId?: string | null;

  /** Device name */
  @Column({ name: 'device_name', type: 'varchar', length: 255, nullable: true })
  deviceName?: string | null;

  /** Device type (desktop, mobile, tablet) */
  @Column({ name: 'device_type', type: 'varchar', length: 50, nullable: true })
  deviceType?: string | null;

  /** User agent */
  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent?: string | null;

  // ─────────────────────────────────────────────────────────────────
  // Location
  // ─────────────────────────────────────────────────────────────────

  /** IP address */
  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress?: string | null;

  /** Geo location */
  @Column({ name: 'geo_location', type: 'jsonb', nullable: true })
  geoLocation?: Record<string, unknown> | null;

  // ─────────────────────────────────────────────────────────────────
  // Status
  // ─────────────────────────────────────────────────────────────────

  /** Is active */
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  /** Is remembered (extended session) */
  @Column({ name: 'is_remembered', type: 'boolean', default: false })
  isRemembered!: boolean;

  // ─────────────────────────────────────────────────────────────────
  // Timestamps
  // ─────────────────────────────────────────────────────────────────

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  /** Last activity */
  @Column({ name: 'last_activity_at', type: 'timestamptz', default: () => 'NOW()' })
  lastActivityAt!: Date;

  /** Session expiry */
  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  /** When revoked */
  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt?: Date | null;

  /** Revocation reason */
  @Column({ name: 'revoked_reason', type: 'varchar', length: 100, nullable: true })
  revokedReason?: string | null;
}

// ============================================================
// BREAK-GLASS SESSION ENTITY
// ============================================================

/**
 * Reason codes for break-glass access
 */
export type BreakGlassReasonCode =
  | 'emergency'
  | 'investigation'
  | 'maintenance'
  | 'compliance_review'
  | 'support_escalation'
  | 'data_recovery';

/**
 * Status of a break-glass session
 */
export type BreakGlassStatus =
  | 'active'
  | 'expired'
  | 'revoked'
  | 'completed';

/**
 * BreakGlassSession entity - tracks emergency access sessions
 *
 * Break-glass access allows authorized users to bypass normal access controls
 * in emergency situations. All break-glass access is heavily audited.
 */
@Entity('break_glass_sessions')
@Index(['userId'])
@Index(['collectionId'])
@Index(['status'])
@Index(['expiresAt'])
export class BreakGlassSession {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // ─────────────────────────────────────────────────────────────────
  // User & Target
  // ─────────────────────────────────────────────────────────────────

  /** User who requested break-glass access */
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  /** Collection being accessed (optional - null means all collections) */
  @Column({ name: 'collection_id', type: 'uuid', nullable: true })
  collectionId?: string | null;

  @ManyToOne(() => CollectionDefinition, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'collection_id' })
  collection?: CollectionDefinition | null;

  /** Specific record being accessed (optional) */
  @Column({ name: 'record_id', type: 'uuid', nullable: true })
  recordId?: string | null;

  // ─────────────────────────────────────────────────────────────────
  // Reason & Justification
  // ─────────────────────────────────────────────────────────────────

  /** Reason code for break-glass access */
  @Column({ name: 'reason_code', type: 'varchar', length: 50 })
  reasonCode!: string;

  /** Detailed justification for the access request */
  @Column({ name: 'justification', type: 'text' })
  justification!: string;

  /** External reference (ticket number, incident ID, etc.) */
  @Column({ name: 'external_reference', type: 'varchar', length: 255, nullable: true })
  externalReference?: string | null;

  // ─────────────────────────────────────────────────────────────────
  // Status & Timing
  // ─────────────────────────────────────────────────────────────────

  /** Current status of the session */
  @Column({ name: 'status', type: 'varchar', length: 20, default: 'active' })
  status!: string;

  /** When the session started */
  @CreateDateColumn({ name: 'started_at', type: 'timestamptz' })
  startedAt!: Date;

  /** When the session expires */
  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  /** When the session ended (completed, revoked, or expired) */
  @Column({ name: 'ended_at', type: 'timestamptz', nullable: true })
  endedAt?: Date | null;

  /** Duration in minutes granted */
  @Column({ name: 'duration_minutes', type: 'integer', default: 60 })
  durationMinutes!: number;

  // ─────────────────────────────────────────────────────────────────
  // Approvals
  // ─────────────────────────────────────────────────────────────────

  /** Whether approval was required for this access */
  @Column({ name: 'approval_required', type: 'boolean', default: false })
  approvalRequired!: boolean;

  /** User who approved the access (if approval was required) */
  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approved_by' })
  approver?: User | null;

  /** When the access was approved */
  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt?: Date | null;

  // ─────────────────────────────────────────────────────────────────
  // Revocation
  // ─────────────────────────────────────────────────────────────────

  /** User who revoked the access (if revoked) */
  @Column({ name: 'revoked_by', type: 'uuid', nullable: true })
  revokedBy?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'revoked_by' })
  revoker?: User | null;

  /** Reason for revocation */
  @Column({ name: 'revocation_reason', type: 'text', nullable: true })
  revocationReason?: string | null;

  // ─────────────────────────────────────────────────────────────────
  // Audit & Context
  // ─────────────────────────────────────────────────────────────────

  /** IP address of the requester */
  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress?: string | null;

  /** User agent of the requester */
  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent?: string | null;

  /** Additional context data */
  @Column({ name: 'context_data', type: 'jsonb', nullable: true })
  contextData?: Record<string, unknown> | null;

  /** Count of actions performed during this session */
  @Column({ name: 'action_count', type: 'integer', default: 0 })
  actionCount!: number;

  /** Last action timestamp */
  @Column({ name: 'last_action_at', type: 'timestamptz', nullable: true })
  lastActionAt?: Date | null;
}
