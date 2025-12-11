import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { TenantNavProfile } from './tenant-nav-profile.entity';

/**
 * NavItemType - Types of navigation items
 */
export enum NavItemType {
  MODULE = 'MODULE',
  TABLE = 'TABLE',
  FORM = 'FORM',
  REPORT = 'REPORT',
  DASHBOARD = 'DASHBOARD',
  LINK = 'LINK',
  SEPARATOR = 'SEPARATOR',
  GROUP = 'GROUP',
  /** Auto-populated group (favorites, recent, frequent) */
  SMART_GROUP = 'SMART_GROUP',
}

/**
 * SmartGroupType - Types of automatically populated navigation groups
 */
export enum SmartGroupType {
  /** User-managed favorites (manual add/remove via star icon) */
  FAVORITES = 'favorites',
  /** Auto-populated based on navigation click history (last 10) */
  RECENT = 'recent',
  /** Auto-populated based on usage frequency (top 5) */
  FREQUENT = 'frequent',
}

/**
 * NavItemVisibility - Visibility rules for navigation items
 */
export interface NavItemVisibility {
  /** User must have ANY of these roles to see this item */
  rolesAny?: string[];
  /** User must have ALL of these roles to see this item */
  rolesAll?: string[];
  /** User must have ANY of these permissions to see this item */
  permissionsAny?: string[];
  /** ANY of these feature flags must be enabled */
  featureFlagsAny?: string[];
  /** DSL expression for complex visibility rules */
  expression?: string;
}

/**
 * TenantNavProfileItem - Individual navigation items within a profile
 *
 * Navigation items represent nodes in the navigation tree. They can be:
 * - Groups (folders containing other items)
 * - Module references (link to a registered Module by key)
 * - Direct links (URL-based navigation)
 * - Smart groups (auto-populated: favorites, recent, frequent)
 * - Separators (visual dividers)
 *
 * Items support hierarchical nesting via parentId and ordering via order.
 * Visibility is controlled by the visibility JSONB field which supports
 * roles, permissions, feature flags, and custom expressions.
 */
@Entity('tenant_nav_profile_items')
@Index(['navProfileId', 'order'])
@Index(['navProfileId', 'key'], { unique: true })
@Index(['parentId'])
@Index(['moduleKey'])
@Index(['type'])
export class TenantNavProfileItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'nav_profile_id', type: 'uuid' })
  navProfileId!: string;

  @ManyToOne(() => TenantNavProfile, (profile) => profile.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'nav_profile_id' })
  navProfile!: TenantNavProfile;

  /**
   * Unique key within the profile for patch targeting
   * Convention: hierarchical path like 'eam.assets' or 'admin.users.list'
   */
  @Column({ type: 'varchar', length: 150, nullable: true })
  key?: string;

  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId?: string;

  /**
   * Self-reference for hierarchical tree structure
   */
  @ManyToOne(() => TenantNavProfileItem)
  @JoinColumn({ name: 'parent_id' })
  parent?: TenantNavProfileItem;

  @Column({ type: 'varchar', length: 255 })
  label!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  icon?: string;

  @Column({
    type: 'enum',
    enum: NavItemType,
    enumName: 'nav_item_type',
    default: NavItemType.LINK,
  })
  type!: NavItemType;

  /**
   * Reference to Module.key for MODULE type items
   * Replaces targetId for modules, providing loose coupling
   */
  @Column({ name: 'module_key', type: 'varchar', length: 150, nullable: true })
  moduleKey?: string;

  /**
   * Legacy: Generic target identifier
   * @deprecated For modules, use moduleKey instead
   */
  @Column({ name: 'target_id', type: 'varchar', length: 255, nullable: true })
  targetId?: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  url?: string;

  @Column({ type: 'int', default: 0 })
  order!: number;

  @Column({ name: 'is_visible', type: 'boolean', default: true })
  isVisible!: boolean;

  /**
   * Legacy: Single permission requirement
   * @deprecated Use visibility.permissionsAny instead
   */
  @Column({ name: 'required_permission', type: 'varchar', length: 100, nullable: true })
  requiredPermission?: string;

  /**
   * Comprehensive visibility rules
   * Supports: rolesAny, rolesAll, permissionsAny, featureFlagsAny, expression
   */
  @Column({ type: 'jsonb', nullable: true })
  visibility?: NavItemVisibility;

  /**
   * Context tags for filtering navigation items
   * Examples: ['agent', 'eu-only', 'beta', 'mobile-hidden']
   * Used by NavigationResolutionService to filter based on context
   */
  @Column({ name: 'context_tags', type: 'varchar', array: true, nullable: true })
  contextTags?: string[];

  /**
   * Smart group type for SMART_GROUP items
   */
  @Column({
    name: 'smart_group_type',
    type: 'enum',
    enum: SmartGroupType,
    enumName: 'smart_group_type_enum',
    nullable: true,
  })
  smartGroupType?: SmartGroupType;

  /**
   * Maximum items to show in smart groups
   * Default: 10 for recent, 5 for frequent
   */
  @Column({ name: 'smart_group_limit', type: 'int', nullable: true })
  smartGroupLimit?: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
