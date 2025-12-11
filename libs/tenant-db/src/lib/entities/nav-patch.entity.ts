import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { TenantNavProfile } from './tenant-nav-profile.entity';

/**
 * NavPatchOperation - Types of patch operations that can be applied to navigation
 */
export enum NavPatchOperation {
  /** Hide a node (keeps in tree but marks invisible) */
  HIDE = 'hide',
  /** Show a previously hidden node */
  SHOW = 'show',
  /** Move a node to a different parent or position */
  MOVE = 'move',
  /** Rename a node's label */
  RENAME = 'rename',
  /** Insert a new node */
  INSERT = 'insert',
  /** Replace a node entirely */
  REPLACE = 'replace',
  /** Clone a node to a different location */
  CLONE = 'clone',
  /** Update visibility rules for a node */
  SET_VISIBILITY = 'set_visibility',
  /** Update node icon */
  SET_ICON = 'set_icon',
  /** Update node order within its parent */
  REORDER = 'reorder',
}

/**
 * NavPatchPayload - Operation-specific data for patches
 */
export interface NavPatchPayload {
  /** New label for RENAME operation */
  label?: string;
  /** New icon for SET_ICON operation */
  icon?: string;
  /** Target parent key for MOVE/CLONE operations */
  newParentKey?: string;
  /** Position within parent for MOVE/CLONE/INSERT/REORDER */
  position?: number | 'first' | 'last' | 'before' | 'after';
  /** Reference node for relative positioning */
  referenceNodeKey?: string;
  /** Complete node definition for INSERT/REPLACE */
  nodeDefinition?: {
    key: string;
    label: string;
    icon?: string;
    type: 'group' | 'module' | 'link' | 'separator' | 'smart_group';
    moduleKey?: string;
    url?: string;
    visibility?: {
      rolesAny?: string[];
      rolesAll?: string[];
      permissionsAny?: string[];
      featureFlagsAny?: string[];
      expression?: string;
    };
    contextTags?: string[];
    children?: NavPatchPayload['nodeDefinition'][];
  };
  /** Visibility rules for SET_VISIBILITY operation */
  visibility?: {
    rolesAny?: string[];
    rolesAll?: string[];
    permissionsAny?: string[];
    featureFlagsAny?: string[];
    expression?: string;
  };
}

/**
 * NavPatch - Modifications to navigation profiles
 *
 * Patches allow tenants to customize navigation without modifying the base
 * template or creating entirely new structures. Patches are applied in
 * priority order when resolving navigation for a user.
 *
 * This enables a layered approach:
 * 1. Template provides base navigation
 * 2. Profile inherits from template
 * 3. Patches modify specific nodes
 *
 * Examples:
 * - Hide the 'Reports' section for basic tier tenants
 * - Rename 'Assets' to 'Equipment' for manufacturing tenants
 * - Insert a custom module into an existing group
 */
@Entity('nav_patches')
@Index(['navProfileId'])
@Index(['navProfileId', 'priority'])
@Index(['operation'])
@Index(['targetNodeKey'])
@Index(['isActive'])
export class NavPatch {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * The navigation profile this patch belongs to
   */
  @Column({ name: 'nav_profile_id', type: 'uuid' })
  navProfileId!: string;

  @ManyToOne(() => TenantNavProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'nav_profile_id' })
  navProfile!: TenantNavProfile;

  /**
   * Type of patch operation to perform
   */
  @Column({
    type: 'enum',
    enum: NavPatchOperation,
    enumName: 'nav_patch_operation_enum',
  })
  operation!: NavPatchOperation;

  /**
   * Key of the nav node this patch targets
   * For INSERT, this is the parent node key
   * For other operations, this is the node being modified
   */
  @Column({ name: 'target_node_key', type: 'varchar', length: 150 })
  targetNodeKey!: string;

  /**
   * Operation-specific payload data
   */
  @Column({ type: 'jsonb', nullable: true })
  payload?: NavPatchPayload;

  /**
   * Priority for applying patches (lower = applied first)
   * Patches with same priority are applied in creation order
   */
  @Column({ type: 'int', default: 100 })
  priority!: number;

  /**
   * Whether this patch is currently active
   */
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  /**
   * Human-readable description of what this patch does
   */
  @Column({ type: 'text', nullable: true })
  description?: string;

  /**
   * Flexible metadata storage
   */
  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
