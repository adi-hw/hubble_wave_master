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
 * Lifecycle status for the collection definition itself (ADR-5).
 *  - draft: Editable, not yet visible to runtime data services
 *  - published: Authoritative, used by runtime
 *  - deprecated: Read-only, scheduled for removal
 */
export type CollectionDefinitionStatus = 'draft' | 'published' | 'deprecated';
export type CollectionDefinitionRevisionStatus = 'draft' | 'published';

/**
 * CollectionDefinition entity - defines data collections (tables)
 * 
 * This is the schema engine's core entity for defining what data
 * structures exist in the system.
 */
@Entity({ name: 'collection_definitions', schema: 'metadata' })
@Index(['code'], { unique: true })
@Index(['tableName'], { unique: true })
@Index(['category'])
@Index(['applicationId'])
@Index(['isActive'])
@Index(['status'])
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

  /**
   * ADR-7 provenance. `pack:<id>` rows are protected on pack upgrade;
   * `custom` rows survive untouched. Studio shell renders a
   * provenance badge per artifact.
   */
  @Column({ name: 'source', type: 'varchar', length: 120, default: 'custom' })
  source!: string;

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

  /**
   * Canon §28.2 level 7 (default-deny fallback). When `true` (the platform
   * default per W2 Pre-W2 baseline + Stream 2 PR4), the field-access
   * evaluator returns canRead=false, canWrite=false, maskingStrategy='FULL'
   * for any field on this collection that no explicit (levels 1-2) or
   * wildcard (levels 3-4) rule matched.
   *
   * Customers who need the legacy default-allow behavior on a specific
   * collection set this flag to `false` explicitly — the §28 evaluator
   * preserves the canRead=true, canWrite=!isSystem, mask='NONE' branch
   * as a per-collection customer-facing opt-out (two protected tests in
   * `authorization.service.spec.ts` guard the explicit-opt-out branch).
   *
   * The Pre-W2 baseline already carries `DEFAULT true` on the column;
   * this entity-level default keeps the runtime + schema in lockstep so
   * code paths that read the entity before re-fetching the row see the
   * right value.
   */
  @Column({ name: 'secure_fields_by_default', type: 'boolean', default: true })
  secureFieldsByDefault!: boolean;

  // ─────────────────────────────────────────────────────────────────
  // Metadata
  // ─────────────────────────────────────────────────────────────────

  /** Additional metadata */
  @Column({ type: 'jsonb', default: () => `'{}'` })
  metadata!: Record<string, unknown>;

  // ─────────────────────────────────────────────────────────────────
  // Lifecycle (ADR-5)
  // ─────────────────────────────────────────────────────────────────

  /** Current lifecycle state of this collection definition. */
  @Column({ type: 'varchar', length: 20, default: 'draft' })
  status!: CollectionDefinitionStatus;

  /** The revision the collection currently advertises as canonical. */
  @Column({ name: 'current_revision_id', type: 'uuid', nullable: true })
  currentRevisionId?: string | null;

  /** When the most recent publish happened (null while draft). */
  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt?: Date | null;

  // Optional fields used by higher layers (not persisted in single-instance build)
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

/**
 * CollectionDefinitionRevision — append-only edit history for a Collection.
 * Mirrors ApplicationRevision so the lifecycle pattern is uniform across
 * metadata entities (ADR-5).
 */
@Entity({ name: 'collection_definition_revisions', schema: 'metadata' })
@Index(['collectionId'])
@Index(['status'])
@Index(['collectionId', 'revision'], { unique: true })
export class CollectionDefinitionRevision {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'collection_id', type: 'uuid' })
  collectionId!: string;

  @ManyToOne(() => CollectionDefinition, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'collection_id' })
  collection?: CollectionDefinition;

  @Column({ name: 'revision', type: 'integer' })
  revision!: number;

  @Column({ name: 'status', type: 'varchar', length: 20 })
  status!: CollectionDefinitionRevisionStatus;

  /**
   * Snapshot of the collection's authoring fields at this revision.
   * Stored as JSON so future fields don't require schema migrations
   * just to be revisioned.
   */
  @Column({ name: 'payload', type: 'jsonb', default: () => `'{}'` })
  payload!: Record<string, unknown>;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdByUser?: User | null;

  @Column({ name: 'published_by', type: 'uuid', nullable: true })
  publishedBy?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'published_by' })
  publishedByUser?: User | null;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
