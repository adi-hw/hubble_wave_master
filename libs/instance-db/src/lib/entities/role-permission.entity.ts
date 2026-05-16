import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from './user.entity';
import { Role } from './role.entity';
import { PlatformPermission } from './platform-permission.entity';

// ============================================================
// ROLE PERMISSION ENTITY
// ============================================================

/**
 * RolePermission entity — maps roles to permission codes.
 *
 * The baseline schema uses a composite primary key on (role_id, permission_code).
 * Permission identity is the colon-segment code string (W2 spec §2.1), not a
 * UUID — the FK targets `identity.platform_permissions(code)` directly.
 *
 * Per W2 spec §2.3 this table is empty at Pre-W2 baseline. Stream 2 PR3's
 * `seed-permission-registry-sync` script populates both the registry and
 * the role grants from `PERMISSION_REGISTRY` constant + the role-grant
 * declarations also in source.
 */
@Entity({ name: 'role_permissions', schema: 'identity' })
@Index(['roleId'])
@Index(['permissionCode'])
export class RolePermission {
  /** Composite PK part 1. */
  @PrimaryColumn({ name: 'role_id', type: 'uuid' })
  roleId!: string;

  @ManyToOne(() => Role, (role) => role.rolePermissions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role?: Role;

  /** Composite PK part 2. References `platform_permissions.code`. */
  @PrimaryColumn({ name: 'permission_code', type: 'text' })
  permissionCode!: string;

  @ManyToOne(() => PlatformPermission, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'permission_code', referencedColumnName: 'code' })
  permission?: PlatformPermission;

  /** When the grant was recorded. */
  @CreateDateColumn({ name: 'granted_at', type: 'timestamptz' })
  grantedAt!: Date;

  /** Who granted it (nullable for seeded / structural grants). */
  @Column({ name: 'granted_by', type: 'uuid', nullable: true })
  grantedBy?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'granted_by' })
  grantedByUser?: User | null;
}

// ============================================================
// USER ROLE ENTITY
// ============================================================

/**
 * Assignment source type
 */
export type AssignmentSource = 'direct' | 'group' | 'rule' | 'sso';

/**
 * UserRole entity - assigns roles to users
 */
@Entity({ name: 'user_roles', schema: 'identity' })
@Unique(['userId', 'roleId'])
@Index(['userId'])
@Index(['roleId'])
@Index(['validFrom', 'validUntil'])
export class UserRole {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** User ID */
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  /** Role ID */
  @Column({ name: 'role_id', type: 'uuid' })
  roleId!: string;

  @ManyToOne(() => Role, (role) => role.userRoles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role?: Role;

  /** How this role was assigned */
  @Column({ type: 'varchar', length: 50, default: 'direct' })
  source!: AssignmentSource;

  /** Source reference (e.g., group ID if assigned via group) */
  @Column({ name: 'source_id', type: 'uuid', nullable: true })
  sourceId?: string | null;

  // ─────────────────────────────────────────────────────────────────
  // Validity Period
  // ─────────────────────────────────────────────────────────────────

  /** Valid from (for time-limited role assignments) */
  @Column({ name: 'valid_from', type: 'timestamptz', default: () => 'NOW()' })
  validFrom!: Date;

  /** Valid until (null = permanent) */
  @Column({ name: 'valid_until', type: 'timestamptz', nullable: true })
  validUntil?: Date | null;

  // ─────────────────────────────────────────────────────────────────
  // Audit
  // ─────────────────────────────────────────────────────────────────

  /** Assigned by user */
  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdByUser?: User | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
