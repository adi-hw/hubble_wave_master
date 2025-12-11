import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * OwnerType - Distinguishes platform-provided vs tenant-created items
 * - platform: Seeded during tenant provisioning, immutable by tenant
 * - tenant: Created by tenant, fully customizable
 */
export enum OwnerType {
  PLATFORM = 'platform',
  TENANT = 'tenant',
}

/**
 * Application - Logical product/domain groupings for navigation
 *
 * Applications are top-level containers that group related modules together.
 * Examples: 'ITSM', 'EAM', 'HRSD', 'Vendor Management'
 *
 * Platform applications are seeded during tenant provisioning and marked
 * with ownerType='platform'. Tenants can create custom applications with
 * ownerType='tenant'.
 */
@Entity('applications')
@Index(['key'], { unique: true })
@Index(['category'])
@Index(['ownerType'])
@Index(['isActive'])
export class Application {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * Unique key for the application
   * Convention: lowercase with dots for namespacing
   * Platform: 'eam', 'itsm', 'hrsd'
   * Tenant: 'acme.vendor_mgmt', 'acme.custom_app'
   */
  @Column({ type: 'varchar', length: 100 })
  key!: string;

  /**
   * Display name shown in navigation
   */
  @Column({ type: 'varchar', length: 255 })
  label!: string;

  /**
   * Lucide icon name for display
   */
  @Column({ type: 'varchar', length: 50, nullable: true })
  icon?: string;

  /**
   * Category for grouping in application picker
   * Examples: 'IT Operations', 'Asset Management', 'HR Services'
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  category?: string;

  /**
   * Distinguishes platform-seeded vs tenant-created applications
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
   * Detailed description of the application
   */
  @Column({ type: 'text', nullable: true })
  description?: string;

  /**
   * Whether this application is active and available for use
   */
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  /**
   * Sort order for display in application lists
   */
  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  /**
   * Flexible metadata storage for future extensibility
   * Can store: color theme, branding, feature flags, etc.
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
