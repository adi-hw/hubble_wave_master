import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { PropertyDefinition } from './property-definition.entity';

/**
 * Schema ownership determines who can modify a collection or property.
 * This is the cornerstone of the governance model.
 * 
 * - **system**: Completely immutable. Core platform infrastructure that cannot
 *   be modified by anyone except through platform updates. Examples: audit_log,
 *   schema_change_log, system_config.
 * 
 * - **platform**: Defined by HubbleWave platform but tenants can EXTEND by adding
 *   custom properties (with x_ prefix). Base properties are immutable.
 *   Examples: users, roles, notifications.
 * 
 * - **custom**: Full tenant control. Can rename, delete, add/remove properties.
 *   Examples: work_orders, assets, any tenant-created collections.
 */
export type SchemaOwner = 'system' | 'platform' | 'custom';

/**
 * Synchronization status between metadata (collection_definition) and
 * physical schema (actual PostgreSQL table).
 * 
 * - **synced**: Metadata and physical schema match perfectly
 * - **pending**: Changes pending sync to physical schema
 * - **error**: Sync failed, see sync_error for details
 * - **orphaned**: Metadata exists but physical table is missing
 */
export type SyncStatus = 'synced' | 'pending' | 'error' | 'orphaned';

/**
 * CollectionDefinition Entity
 * 
 * Represents the metadata layer for a data table in HubbleWave. Each collection
 * maps to a physical PostgreSQL table (specified by storage_table) but adds
 * rich application-level metadata that PostgreSQL cannot express: display labels,
 * icons, permissions, governance rules, and more.
 * 
 * The separation between metadata and physical storage enables:
 * 1. Rich UI configuration without database constraints
 * 2. Governance controls (who can modify what)
 * 3. Drift detection and synchronization
 * 4. Safe platform upgrades that preserve customizations
 * 
 * @example
 * ```typescript
 * // Creating a custom collection
 * const workOrders = await collectionService.createCollection({
 *   code: 'work_orders',
 *   label: 'Work Orders',
 *   icon: 'clipboard-list',
 * }, { userId: currentUser.id });
 * 
 * // This creates:
 * // 1. A collection_definition row (metadata)
 * // 2. A t_work_orders table (physical storage)
 * ```
 */
@Entity('collection_definition')
@Index('idx_collection_code', ['code'], { unique: true })
@Index('idx_collection_owner', ['owner'])
@Index('idx_collection_sync_status', ['syncStatus'])
@Index('idx_collection_category', ['category'])
export class CollectionDefinition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ═══════════════════════════════════════════════════════════════════════════
  // IDENTIFICATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Internal code/identifier for the collection. Used in APIs, URLs, and code.
   * Must be lowercase snake_case: work_orders, user_profiles, etc.
   * Cannot be changed after creation for platform/system collections.
   */
  @Column({ type: 'varchar', length: 100, unique: true })
  code: string;

  /**
   * Human-readable display label shown in the UI.
   * Example: "Work Orders", "User Profiles"
   */
  @Column({ type: 'varchar', length: 200 })
  label: string;

  /**
   * Plural form of the label for list views and counts.
   * Example: "Work Orders" (when there are multiple)
   */
  @Column({ type: 'varchar', length: 200, nullable: true })
  labelPlural: string;

  /**
   * Optional description explaining the purpose of this collection.
   * Shown in Studio and help tooltips.
   */
  @Column({ type: 'text', nullable: true })
  description: string;

  /**
   * Lucide icon name to display for this collection.
   * See: https://lucide.dev/icons
   */
  @Column({ type: 'varchar', length: 50, nullable: true })
  icon: string;

  /**
   * Brand color for this collection (hex code or CSS color name).
   * Used for badges, highlights, and visual identification.
   */
  @Column({ type: 'varchar', length: 20, nullable: true })
  color: string;

  // ═══════════════════════════════════════════════════════════════════════════
  // PHYSICAL STORAGE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Name of the actual PostgreSQL table that stores this collection's data.
   * Convention: custom collections use 't_' prefix (t_work_orders).
   * Platform collections may use different naming (tenant_user, etc.).
   */
  @Column({ type: 'varchar', length: 100, name: 'storage_table' })
  storageTable: string;

  /**
   * PostgreSQL schema where the table lives.
   * Usually 'public' unless multi-schema isolation is used.
   */
  @Column({ type: 'varchar', length: 50, name: 'storage_schema', default: 'public' })
  storageSchema: string;

  // ═══════════════════════════════════════════════════════════════════════════
  // GOVERNANCE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Ownership determines what modifications are allowed.
   * See SchemaOwner type for detailed explanation.
   */
  @Column({ 
    type: 'enum', 
    enum: ['system', 'platform', 'custom'],
    default: 'custom' 
  })
  owner: SchemaOwner;

  /**
   * Current sync status between metadata and physical schema.
   * Drift detection updates this automatically.
   */
  @Column({ 
    type: 'enum', 
    enum: ['synced', 'pending', 'error', 'orphaned'],
    name: 'sync_status',
    default: 'synced' 
  })
  syncStatus: SyncStatus;

  /**
   * Error message if syncStatus is 'error'.
   * Contains details about what went wrong during sync.
   */
  @Column({ type: 'text', name: 'sync_error', nullable: true })
  syncError: string;

  /**
   * Timestamp of last successful synchronization check.
   */
  @Column({ type: 'timestamptz', name: 'last_synced_at', nullable: true })
  lastSyncedAt: Date;

  /**
   * SHA-256 hash of physical table structure (columns, types, constraints).
   * Used for efficient drift detection without full schema comparison.
   */
  @Column({ type: 'varchar', length: 64, name: 'physical_checksum', nullable: true })
  physicalChecksum: string;

  /**
   * Hard lock that prevents ALL modifications, even by system.
   * Used during migrations or when a collection must be frozen.
   */
  @Column({ type: 'boolean', name: 'is_locked', default: false })
  isLocked: boolean;

  /**
   * Platform version when this collection was created/last modified.
   * Used for upgrade compatibility tracking.
   */
  @Column({ type: 'varchar', length: 20, name: 'platform_version', nullable: true })
  platformVersion: string;

  // ═══════════════════════════════════════════════════════════════════════════
  // BEHAVIOR FLAGS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Whether tenants can add custom properties to this collection.
   * True for most collections, false for system tables.
   */
  @Column({ type: 'boolean', name: 'is_extensible', default: true })
  isExtensible: boolean;

  /**
   * Whether records in this collection can have file attachments.
   */
  @Column({ type: 'boolean', name: 'supports_attachments', default: true })
  supportsAttachments: boolean;

  /**
   * Whether records can have comments/notes attached.
   */
  @Column({ type: 'boolean', name: 'supports_comments', default: true })
  supportsComments: boolean;

  /**
   * Whether to track full change history for records.
   * Important for PHI/audit requirements.
   */
  @Column({ type: 'boolean', name: 'supports_history', default: true })
  supportsHistory: boolean;

  // ═══════════════════════════════════════════════════════════════════════════
  // HIERARCHY
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Optional parent collection for hierarchical organization.
   * Used for UI grouping in Studio, not data inheritance.
   */
  @Column({ type: 'uuid', name: 'parent_collection_id', nullable: true })
  parentCollectionId: string;

  @ManyToOne(() => CollectionDefinition, { nullable: true })
  @JoinColumn({ name: 'parent_collection_id' })
  parentCollection: CollectionDefinition;

  /**
   * Optional base collection that this collection extends.
   * Extended collections inherit properties from their base.
   * Future feature for collection inheritance.
   */
  @Column({ type: 'uuid', name: 'extends_collection_id', nullable: true })
  extendsCollectionId: string;

  @ManyToOne(() => CollectionDefinition, { nullable: true })
  @JoinColumn({ name: 'extends_collection_id' })
  extendsCollection: CollectionDefinition;

  // ═══════════════════════════════════════════════════════════════════════════
  // CLASSIFICATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Category for organizing collections in Studio.
   * Common values: 'core', 'custom', 'system', 'integration'
   */
  @Column({ type: 'varchar', length: 50, default: 'custom' })
  category: string;

  /**
   * System collections are platform infrastructure.
   * Hidden from regular users, only visible in admin mode.
   */
  @Column({ type: 'boolean', name: 'is_system', default: false })
  isSystem: boolean;

  /**
   * Hidden collections don't appear in navigation or search.
   * Used for internal/background collections.
   */
  @Column({ type: 'boolean', name: 'is_hidden', default: false })
  isHidden: boolean;

  // ═══════════════════════════════════════════════════════════════════════════
  // AUDIT
  // ═══════════════════════════════════════════════════════════════════════════

  @Column({ type: 'uuid', name: 'created_by', nullable: true })
  createdBy: string;

  @Column({ type: 'uuid', name: 'updated_by', nullable: true })
  updatedBy: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;

  // ═══════════════════════════════════════════════════════════════════════════
  // RELATIONSHIPS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Properties (fields) defined for this collection.
   */
  @OneToMany(() => PropertyDefinition, (property) => property.collection, {
    cascade: true,
    eager: false,
  })
  properties: PropertyDefinition[];

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPER METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Returns true if this collection can be deleted by tenants.
   */
  canBeDeleted(): boolean {
    return this.owner === 'custom' && !this.isLocked;
  }

  /**
   * Returns true if this collection can be renamed by tenants.
   */
  canBeRenamed(): boolean {
    return this.owner === 'custom' && !this.isLocked;
  }

  /**
   * Returns true if tenants can add custom properties.
   */
  canAddProperties(): boolean {
    return this.isExtensible && !this.isLocked && this.owner !== 'system';
  }

  /**
   * Returns the required prefix for custom properties on this collection.
   * Platform collections require 'x_' prefix to prevent collision with
   * future platform properties.
   */
  getCustomPropertyPrefix(): string | null {
    return this.owner === 'platform' ? 'x_' : null;
  }

  /**
   * Returns the full qualified table name for SQL queries.
   */
  getFullTableName(): string {
    return `"${this.storageSchema}"."${this.storageTable}"`;
  }
}
