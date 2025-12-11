import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { OwnerType } from './application.entity';

/**
 * ModuleType - The type of content/action this module represents
 */
export enum ModuleType {
  LIST = 'list',           // Table/list view
  RECORD = 'record',       // Single record view
  DASHBOARD = 'dashboard', // Dashboard with widgets
  WIZARD = 'wizard',       // Multi-step wizard
  URL = 'url',             // External URL
  CUSTOM = 'custom',       // Custom component
  REPORT = 'report',       // Report view
  FORM = 'form',           // Standalone form
}

/**
 * ModuleTargetConfig - Configuration for module navigation target
 */
export interface ModuleTargetConfig {
  /** Table name for list/record modules */
  table?: string;
  /** Route path for internal navigation */
  route?: string;
  /** External URL for url-type modules */
  url?: string;
  /** Custom component name for custom-type modules */
  component?: string;
  /** Default filter for list modules */
  filter?: Record<string, unknown>;
  /** Query parameters to include */
  queryParams?: Record<string, string>;
}

/**
 * ModuleSecurity - Security configuration for module visibility
 */
export interface ModuleSecurity {
  /** User must have ANY of these roles */
  rolesAny?: string[];
  /** User must have ALL of these roles */
  rolesAll?: string[];
  /** User must have ANY of these permissions */
  permissionsAny?: string[];
  /** Feature flag that must be enabled */
  featureFlag?: string;
  /** Custom expression for complex visibility rules */
  expression?: string;
}

/**
 * Module - Reusable navigation actions/pages
 *
 * Modules represent navigable destinations in the application.
 * They are NOT tied to a single menu location - they can be referenced
 * by multiple NavProfileItems across different profiles.
 *
 * Examples:
 * - 'eam.asset.list' - Asset list view
 * - 'itsm.incident.dashboard' - Incident dashboard
 * - 'acme.custom_report' - Tenant's custom report
 */
@Entity('modules')
@Index(['key'], { unique: true })
@Index(['slug'], { unique: true })
@Index(['applicationKey'])
@Index(['type'])
@Index(['ownerType'])
@Index(['isActive'])
export class ModuleEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * Unique key for the module
   * Convention: {applicationKey}.{domain}.{action}
   * Examples: 'eam.asset.list', 'itsm.incident.create', 'acme.vendor.dashboard'
   */
  @Column({ type: 'varchar', length: 150 })
  key!: string;

  /**
   * Legacy: Display name (kept for backward compatibility)
   * @deprecated Use label instead
   */
  @Column()
  name!: string;

  /**
   * Display label shown in navigation
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  label?: string;

  /**
   * Legacy: URL-friendly slug (kept for backward compatibility)
   */
  @Column()
  slug!: string;

  /**
   * Application this module belongs to
   * References Application.key for loose coupling
   */
  @Column({ name: 'application_key', type: 'varchar', length: 100, nullable: true })
  applicationKey?: string;

  /**
   * Type of module determining rendering and behavior
   */
  @Column({
    type: 'enum',
    enum: ModuleType,
    enumName: 'module_type_enum',
    default: ModuleType.LIST,
  })
  type!: ModuleType;

  /**
   * Target configuration for navigation
   * Contains: table, route, url, component, filter, queryParams
   */
  @Column({ name: 'target_config', type: 'jsonb', nullable: true })
  targetConfig?: ModuleTargetConfig;

  @Column({ type: 'text', nullable: true })
  description?: string;

  /**
   * Legacy: Route path (kept for backward compatibility)
   * @deprecated Use targetConfig.route instead
   */
  @Column({ nullable: true })
  route?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  icon?: string;

  /**
   * Legacy: Category for grouping (kept for backward compatibility)
   * @deprecated Use applicationKey for grouping
   */
  @Column({ nullable: true })
  category?: string;

  /**
   * Security configuration for module visibility
   * Contains: rolesAny, rolesAll, permissionsAny, featureFlag, expression
   */
  @Column({ type: 'jsonb', nullable: true })
  security?: ModuleSecurity;

  /**
   * Distinguishes platform-seeded vs tenant-created modules
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
   * Whether this module is active and available for use
   */
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

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
