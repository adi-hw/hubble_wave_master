import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { User } from './user.entity';
import { Role } from './role.entity';
import { Permission } from './permission.entity';

// ============================================================
// ROLE PERMISSION ENTITY
// ============================================================

/**
 * RolePermission entity - maps permissions to roles
 * 
 * NOTE: This is NOT "tenant_role_permissions" - we don't use tenant terminology!
 */
@Entity('role_permissions')
@Unique(['roleId', 'permissionId'])
@Index(['roleId'])
@Index(['permissionId'])
export class RolePermission {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Role ID */
  @Column({ name: 'role_id', type: 'uuid' })
  roleId!: string;

  @ManyToOne(() => Role, (role) => role.rolePermissions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role?: Role;

  /** Permission ID */
  @Column({ name: 'permission_id', type: 'uuid' })
  permissionId!: string;

  @ManyToOne(() => Permission, (perm) => perm.rolePermissions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'permission_id' })
  permission?: Permission;

  /** ABAC conditions (optional - for conditional permissions) */
  @Column({ type: 'jsonb', nullable: true })
  conditions?: Record<string, unknown> | null;

  /** Granted by user */
  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdByUser?: User | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
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
 * 
 * NOTE: This is NOT "tenant_user_roles" - we don't use tenant terminology!
 */
@Entity('user_roles')
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
