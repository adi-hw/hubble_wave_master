import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { TenantNavProfileItem } from './tenant-nav-profile-item.entity';

/**
 * TenantNavProfile - Navigation profiles for tenant users
 *
 * Navigation profiles define the menu structure and available
 * navigation items for different user roles or groups.
 *
 * Profiles can inherit from templates and be customized via patches.
 * Multiple profiles can exist for different personas (agent, manager, admin).
 *
 * Auto-assignment:
 * - Users can be auto-assigned to profiles based on roles (autoAssignRoles)
 * - Or via custom expressions (autoAssignExpression)
 * - Users with multiple matching profiles can switch between them
 */
@Entity('tenant_nav_profiles')
@Index(['slug'], { unique: true })
@Index(['templateKey'])
@Index(['isDefault'])
@Index(['isActive'])
@Index(['inheritsFromProfileId'])
export class TenantNavProfile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  slug!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  /**
   * Template this profile is based on
   * References NavTemplate.key for loose coupling
   * If set, the profile inherits the template's nav structure as its base
   */
  @Column({ name: 'template_key', type: 'varchar', length: 100, nullable: true })
  templateKey?: string;

  /**
   * Checksum of the template's navStructure at time of profile creation
   * Used to detect when the template has been updated and prompt for sync
   */
  @Column({ name: 'base_checksum', type: 'varchar', length: 64, nullable: true })
  baseChecksum?: string;

  /**
   * Roles that automatically get this profile
   * Users with ANY of these roles will have this profile available
   */
  @Column({ name: 'auto_assign_roles', type: 'varchar', array: true, nullable: true })
  autoAssignRoles?: string[];

  /**
   * DSL expression for complex auto-assignment rules
   * Example: "user.department == 'IT' && hasRole('technician')"
   */
  @Column({ name: 'auto_assign_expression', type: 'text', nullable: true })
  autoAssignExpression?: string;

  /**
   * Whether this profile is locked (cannot be edited)
   * Useful for platform-provided profiles
   */
  @Column({ name: 'is_locked', type: 'boolean', default: false })
  isLocked!: boolean;

  /**
   * Profile inheritance - this profile inherits from another profile
   * Allows creating variations of existing profiles
   */
  @Column({ name: 'inherits_from_profile_id', type: 'uuid', nullable: true })
  inheritsFromProfileId?: string;

  @ManyToOne(() => TenantNavProfile)
  @JoinColumn({ name: 'inherits_from_profile_id' })
  inheritsFromProfile?: TenantNavProfile;

  /**
   * Priority for auto-assignment when multiple profiles match
   * Lower number = higher priority
   */
  @Column({ name: 'priority', type: 'int', default: 100 })
  priority!: number;

  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault!: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @OneToMany(() => TenantNavProfileItem, (item) => item.navProfile, { cascade: true })
  items?: TenantNavProfileItem[];

  /**
   * Flexible metadata storage
   * Can store: theme preferences, icon set, collapsed state defaults, etc.
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

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
