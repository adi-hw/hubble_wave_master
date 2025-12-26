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
import { RolePermission, UserRole } from './role-permission.entity';

/**
 * Role scope
 */
export type RoleScope = 'global' | 'collection' | 'record';

/**
 * Role entity - defines roles for RBAC
 * 
 * NOTE: This is NOT "tenant_roles" - we don't use tenant terminology!
 * This table exists in each customer's isolated database.
 * There is NO tenant_id column.
 */
@Entity('roles')
@Index(['code'], { unique: true })
@Index(['parentId'])
@Index(['isSystem'])
@Index(['isActive'])
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Unique role code (e.g., 'admin', 'technician', 'manager') */
  @Column({ type: 'varchar', length: 100, unique: true })
  code!: string;

  /** Display name */
  @Column({ type: 'varchar', length: 255 })
  name!: string;

  /** Description */
  @Column({ type: 'text', nullable: true })
  description?: string | null;

  // ─────────────────────────────────────────────────────────────────
  // Hierarchy
  // ─────────────────────────────────────────────────────────────────

  /** Parent role (for role inheritance) */
  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId?: string | null;

  @ManyToOne(() => Role, { nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent?: Role | null;

  /** Hierarchy level (for faster queries) */
  @Column({ name: 'hierarchy_level', type: 'integer', default: 0 })
  hierarchyLevel!: number;

  /** Full path (e.g., 'admin.manager.technician') for hierarchy queries */
  @Column({ name: 'hierarchy_path', type: 'varchar', length: 500, nullable: true })
  hierarchyPath?: string | null;

  // ─────────────────────────────────────────────────────────────────
  // Configuration
  // ─────────────────────────────────────────────────────────────────

  /** Role scope (where does this role apply) */
  @Column({ type: 'varchar', length: 50, default: 'global' })
  scope!: RoleScope;

  /** Maximum number of users that can have this role (null = unlimited) */
  @Column({ name: 'max_users', type: 'integer', nullable: true })
  maxUsers?: number | null;

  /** Role weight for conflict resolution (higher = more priority) */
  @Column({ type: 'integer', default: 0 })
  weight!: number;

  // ─────────────────────────────────────────────────────────────────
  // Flags
  // ─────────────────────────────────────────────────────────────────

  /** System role (cannot be deleted or modified by users) */
  @Column({ name: 'is_system', type: 'boolean', default: false })
  isSystem!: boolean;

  /** Active status */
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  /** Default role for new users */
  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault!: boolean;

  // ─────────────────────────────────────────────────────────────────
  // Display
  // ─────────────────────────────────────────────────────────────────

  /** Icon for UI display */
  @Column({ type: 'varchar', length: 100, nullable: true })
  icon?: string | null;

  /** Color for UI display */
  @Column({ type: 'varchar', length: 50, nullable: true })
  color?: string | null;

  // ─────────────────────────────────────────────────────────────────
  // Metadata
  // ─────────────────────────────────────────────────────────────────

  /** Additional metadata */
  @Column({ type: 'jsonb', default: () => `'{}'` })
  metadata!: Record<string, unknown>;

  // ─────────────────────────────────────────────────────────────────
  // Relations
  // ─────────────────────────────────────────────────────────────────

  @OneToMany(() => RolePermission, (rp: RolePermission) => rp.role)
  rolePermissions?: RolePermission[];

  @OneToMany(() => UserRole, (ur: UserRole) => ur.role)
  userRoles?: UserRole[];

  // ─────────────────────────────────────────────────────────────────
  // Audit Fields
  // ─────────────────────────────────────────────────────────────────

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdByUser?: User | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'updated_by' })
  updatedByUser?: User | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
