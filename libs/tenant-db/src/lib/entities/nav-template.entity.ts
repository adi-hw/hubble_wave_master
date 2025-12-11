import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { OwnerType } from './application.entity';

/**
 * NavTemplateNode - Structure for navigation tree nodes within a template
 */
export interface NavTemplateNode {
  /** Unique key within the template */
  key: string;
  /** Display label */
  label: string;
  /** Icon name (Lucide) */
  icon?: string;
  /** Node type */
  type: 'group' | 'module' | 'link' | 'separator' | 'smart_group';
  /** Reference to module key (for module type) */
  moduleKey?: string;
  /** Direct URL (for link type) */
  url?: string;
  /** Nested children */
  children?: NavTemplateNode[];
  /** Display order */
  order?: number;
  /** Visibility rules (inherited by nav items created from template) */
  visibility?: {
    rolesAny?: string[];
    rolesAll?: string[];
    permissionsAny?: string[];
    featureFlagsAny?: string[];
    expression?: string;
  };
  /** Smart group type (for smart_group type) */
  smartGroupType?: 'favorites' | 'recent' | 'frequent';
  /** Context tags for filtering */
  contextTags?: string[];
}

/**
 * NavTemplate - Predefined navigation structures for profiles
 *
 * Templates define the base navigation structure that profiles can inherit from.
 * When a profile uses a template, it gets a copy of the template's nav structure
 * which can then be modified via NavPatches.
 *
 * Platform templates are seeded during tenant provisioning (ownerType='platform').
 * Tenants can create custom templates (ownerType='tenant').
 *
 * Examples:
 * - 'default_eam' - Standard EAM navigation for all users
 * - 'healthcare_eam' - EAM with healthcare-specific modules
 * - 'manufacturing_eam' - EAM with manufacturing focus
 */
@Entity('nav_templates')
@Index(['key'], { unique: true })
@Index(['category'])
@Index(['ownerType'])
@Index(['isActive'])
export class NavTemplate {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * Unique key for the template
   * Convention: {purpose}_{application} or {industry}_{application}
   * Examples: 'default_eam', 'healthcare_eam', 'admin_portal'
   */
  @Column({ type: 'varchar', length: 100 })
  key!: string;

  /**
   * Display name for the template
   */
  @Column({ type: 'varchar', length: 255 })
  name!: string;

  /**
   * Detailed description of the template
   */
  @Column({ type: 'text', nullable: true })
  description?: string;

  /**
   * Category for grouping templates
   * Examples: 'Industry Template', 'Starter', 'Role-Based'
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  category?: string;

  /**
   * Distinguishes platform-seeded vs tenant-created templates
   */
  @Column({
    name: 'owner_type',
    type: 'enum',
    enum: OwnerType,
    enumName: 'owner_type_enum',
    default: OwnerType.TENANT,
  })
  ownerType!: OwnerType;

  /**
   * Application keys this template is designed for
   * Used to filter available templates when creating a profile
   */
  @Column({ name: 'base_applications', type: 'varchar', array: true, nullable: true })
  baseApplications?: string[];

  /**
   * Complete navigation tree structure
   * This is the source of truth for the template's navigation
   */
  @Column({ name: 'nav_structure', type: 'jsonb' })
  navStructure!: NavTemplateNode[];

  /**
   * Whether this template is active and available for use
   */
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  /**
   * Template version for tracking changes
   * Format: semver (e.g., '1.0.0', '1.2.3')
   */
  @Column({ type: 'varchar', length: 20, default: '1.0.0' })
  version!: string;

  /**
   * Checksum of navStructure for change detection
   * Used to detect template updates for profiles using this template
   */
  @Column({ type: 'varchar', length: 64, nullable: true })
  checksum?: string;

  /**
   * Flexible metadata storage for future extensibility
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
