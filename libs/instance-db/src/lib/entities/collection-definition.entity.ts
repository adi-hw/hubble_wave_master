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
import { PropertyDefinition } from './property-definition.entity';

/**
 * Owner type for collections/properties
 * - system: Immutable infrastructure collections (audit logs, schema tracking)
 * - platform: Core platform collections, extensible with custom properties
 * - custom: User-created collections with full control
 */
export type OwnerType = 'system' | 'platform' | 'custom';

/**
 * CollectionDefinition entity - defines data collections (tables)
 * 
 * This is the schema engine's core entity for defining what data
 * structures exist in the system.
 */
@Entity('collection_definitions')
@Index(['code'], { unique: true })
@Index(['tableName'], { unique: true })
@Index(['category'])
@Index(['applicationId'])
@Index(['isActive'])
export class CollectionDefinition {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // ─────────────────────────────────────────────────────────────────
  // Identity
  // ─────────────────────────────────────────────────────────────────

  /** Unique collection code (e.g., 'incident', 'asset', 'work_order') */
  @Column({ type: 'varchar', length: 100, unique: true })
  code!: string;

  /** Display name (singular) */
  @Column({ type: 'varchar', length: 255 })
  name!: string;

  /** Display name (plural) */
  @Column({ name: 'plural_name', type: 'varchar', length: 255, nullable: true })
  pluralName?: string | null;

  /** Description */
  @Column({ type: 'text', nullable: true })
  description?: string | null;

  // ─────────────────────────────────────────────────────────────────
  // Classification
  // ─────────────────────────────────────────────────────────────────

  /** Category for grouping */
  @Column({ type: 'varchar', length: 100, nullable: true })
  category?: string | null;

  /** Application/module this collection belongs to */
  @Column({ name: 'application_id', type: 'uuid', nullable: true })
  applicationId?: string | null;

  /** Owner type (system, module, or custom) */
  @Column({ name: 'owner_type', type: 'varchar', length: 20, default: 'custom' })
  ownerType!: OwnerType;

  // ─────────────────────────────────────────────────────────────────
  // Table Configuration
  // ─────────────────────────────────────────────────────────────────

  /** Actual database table name */
  @Column({ name: 'table_name', type: 'varchar', length: 100, unique: true })
  tableName!: string;

  /** Property code used as display label (e.g., 'name', 'number') */
  @Column({ name: 'label_property', type: 'varchar', length: 100, default: 'name' })
  labelProperty!: string;

  /** Property code used as secondary label */
  @Column({ name: 'secondary_label_property', type: 'varchar', length: 100, nullable: true })
  secondaryLabelProperty?: string | null;

  // ─────────────────────────────────────────────────────────────────
  // Features
  // ─────────────────────────────────────────────────────────────────

  /** Can users add custom properties */
  @Column({ name: 'is_extensible', type: 'boolean', default: true })
  isExtensible!: boolean;

  /** Is change history tracked */
  @Column({ name: 'is_audited', type: 'boolean', default: true })
  isAudited!: boolean;

  /** Is versioning enabled */
  @Column({ name: 'enable_versioning', type: 'boolean', default: false })
  enableVersioning!: boolean;

  /** Are attachments enabled */
  @Column({ name: 'enable_attachments', type: 'boolean', default: true })
  enableAttachments!: boolean;

  /** Is activity log enabled */
  @Column({ name: 'enable_activity_log', type: 'boolean', default: true })
  enableActivityLog!: boolean;

  /** Enable full-text search */
  @Column({ name: 'enable_search', type: 'boolean', default: true })
  enableSearch!: boolean;

  // ─────────────────────────────────────────────────────────────────
  // Flags
  // ─────────────────────────────────────────────────────────────────

  /** System collection (cannot be deleted) */
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
  // Access Control
  // ─────────────────────────────────────────────────────────────────

  /** Default access level for this collection */
  @Column({ name: 'default_access', type: 'varchar', length: 20, default: 'read' })
  defaultAccess!: string;

  // ─────────────────────────────────────────────────────────────────
  // Metadata
  // ─────────────────────────────────────────────────────────────────

  /** Additional metadata */
  @Column({ type: 'jsonb', default: () => `'{}'` })
  metadata!: Record<string, unknown>;

  // Optional fields used by higher layers (not persisted in single-instance build)
  status?: string;
  publishedAt?: Date | null;
  deletedAt?: Date | null;
  propertyCount?: number;
  recordCount?: number;
  sortOrder?: number;
  moduleId?: string | null;
  extendsCollectionId?: string | null;
  storageSchema?: string;
  storageTable?: string;
  version?: number;
  isVersioned?: boolean;
  tags?: string[];

  // ─────────────────────────────────────────────────────────────────
  // Relations
  // ─────────────────────────────────────────────────────────────────

  @OneToMany(() => PropertyDefinition, (prop) => prop.collection)
  properties?: PropertyDefinition[];

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
