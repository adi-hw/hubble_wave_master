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
@Index(['roleId'])
@Index(['groupId'])
@Index(['userId'])
export class PropertyAccessRule {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Property this rule applies to */
  @Column({ name: 'property_id', type: 'uuid' })
  propertyId!: string;

  @ManyToOne(() => PropertyDefinition, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'property_id' })
  property?: PropertyDefinition;

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
