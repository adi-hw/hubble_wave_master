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
  Unique,
} from 'typeorm';
import { User } from './user.entity';
import { Role } from './role.entity';

// ============================================================
// GROUP ENTITY
// ============================================================

/**
 * Group type
 */
export enum GroupType {
  STANDARD = 'standard',
  DEPARTMENT = 'department',
  TEAM = 'team',
  LOCATION = 'location',
  DYNAMIC = 'dynamic',
}

/**
 * Group entity - defines user groups
 * 
 * NOTE: This is NOT "tenant_groups" - we don't use tenant terminology!
 * This table exists in each customer's isolated database.
 */
@Entity('groups')
@Index(['code'], { unique: true })
@Index(['parentId'])
@Index(['type'])
@Index(['isActive'])
export class Group {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Unique group code */
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

  /** Parent group */
  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId?: string | null;

  @ManyToOne(() => Group, (group) => group.children, { nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent?: Group | null;

  @OneToMany(() => Group, (group) => group.parent)
  children?: Group[];

  /** Hierarchy level */
  @Column({ name: 'hierarchy_level', type: 'integer', default: 0 })
  hierarchyLevel!: number;

  /** Full path for hierarchy queries */
  @Column({ name: 'hierarchy_path', type: 'varchar', length: 500, nullable: true })
  hierarchyPath?: string | null;

  // ─────────────────────────────────────────────────────────────────
  // Configuration
  // ─────────────────────────────────────────────────────────────────

  /** Group type */
  @Column({ type: 'varchar', length: 50, default: GroupType.STANDARD })
  type!: GroupType;

  /** Dynamic membership rules (for dynamic groups) */
  @Column({ name: 'membership_rules', type: 'jsonb', nullable: true })
  membershipRules?: Record<string, unknown> | null;

  // ─────────────────────────────────────────────────────────────────
  // Flags
  // ─────────────────────────────────────────────────────────────────

  /** System group (cannot be deleted) */
  @Column({ name: 'is_system', type: 'boolean', default: false })
  isSystem!: boolean;

  /** Active status */
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

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

  @OneToMany(() => GroupMember, (gm) => gm.group)
  members?: GroupMember[];

  @OneToMany(() => GroupRole, (gr) => gr.group)
  groupRoles?: GroupRole[];

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
// GROUP MEMBER ENTITY
// ============================================================

/**
 * GroupMember entity - maps users to groups
 * 
 * NOTE: This is NOT "tenant_group_members" - we don't use tenant terminology!
 */
@Entity('group_members')
@Unique(['groupId', 'userId'])
@Index(['groupId'])
@Index(['userId'])
export class GroupMember {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Group ID */
  @Column({ name: 'group_id', type: 'uuid' })
  groupId!: string;

  @ManyToOne(() => Group, (group) => group.members, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_id' })
  group?: Group;

  /** User ID */
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  /** Is group manager */
  @Column({ name: 'is_manager', type: 'boolean', default: false })
  isManager!: boolean;

  // ─────────────────────────────────────────────────────────────────
  // Validity Period
  // ─────────────────────────────────────────────────────────────────

  /** Valid from */
  @Column({ name: 'valid_from', type: 'timestamptz', default: () => 'NOW()' })
  validFrom!: Date;

  /** Valid until (null = permanent) */
  @Column({ name: 'valid_until', type: 'timestamptz', nullable: true })
  validUntil?: Date | null;

  // ─────────────────────────────────────────────────────────────────
  // Audit
  // ─────────────────────────────────────────────────────────────────

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdByUser?: User | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

// ============================================================
// GROUP ROLE ENTITY
// ============================================================

/**
 * GroupRole entity - assigns roles to groups (inherited by all members)
 * 
 * NOTE: This is NOT "tenant_group_roles" - we don't use tenant terminology!
 */
@Entity('group_roles')
@Unique(['groupId', 'roleId'])
@Index(['groupId'])
@Index(['roleId'])
export class GroupRole {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Group ID */
  @Column({ name: 'group_id', type: 'uuid' })
  groupId!: string;

  @ManyToOne(() => Group, (group) => group.groupRoles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_id' })
  group?: Group;

  /** Role ID */
  @Column({ name: 'role_id', type: 'uuid' })
  roleId!: string;

  @ManyToOne(() => Role, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role?: Role;

  // ─────────────────────────────────────────────────────────────────
  // Audit
  // ─────────────────────────────────────────────────────────────────

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdByUser?: User | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
