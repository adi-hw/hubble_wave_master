import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { User } from './user.entity';
import { CollectionDefinition, OwnerType } from './collection-definition.entity';
import { PropertyType } from './property-type.entity';

/**
 * Default value type
 */
export type DefaultValueType = 'static' | 'expression' | 'script' | 'current_user' | 'current_datetime';

/**
 * Lifecycle status for the property definition itself (ADR-5).
 * Mirrors CollectionDefinitionStatus.
 */
export type PropertyDefinitionStatus = 'draft' | 'published' | 'deprecated';
export type PropertyDefinitionRevisionStatus = 'draft' | 'published';

/**
 * Plan §6.3 behavioral attributes registry. Each key is a discrete
 * runtime hook the platform consults when reading or writing the
 * property. Values default to "off" — absent keys are treated as
 * disabled so adopters can introduce new attributes without
 * back-filling every existing row.
 */
export interface PropertyBehavioralAttributes {
  /** Encrypt the field's value before storage via shared encryption service. */
  encrypt_at_rest?: boolean;
  /** Track changes to this property in the audit-log subscriber's tracked-changes set. */
  audit?: boolean;
  /** Redact the field's value in notification provider-error log lines. */
  mask_in_logs?: boolean;
  /** Surface this property on the mobile shell. Default exposes everything. */
  mobile_visible?: boolean;
  /** Caching policy for computed properties (formula/rollup/lookup). */
  formula_cache_strategy?: 'none' | 'memoize' | 'persist';
}

/**
 * PropertyDefinition entity - defines fields on collections
 * 
 * This is the schema engine's entity for defining what fields/columns
 * exist on each collection.
 */
@Entity({ name: 'property_definitions', schema: 'metadata' })
@Unique(['collectionId', 'code'])
@Index(['collectionId'])
@Index(['propertyTypeId'])
@Index(['referenceCollectionId'])
@Index(['isActive'])
@Index(['status'])
@Index(['applicationId'])
export class PropertyDefinition {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Collection this property belongs to */
  @Column({ name: 'collection_id', type: 'uuid' })
  collectionId!: string;

  @ManyToOne(() => CollectionDefinition, (col) => col.properties, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'collection_id' })
  collection?: CollectionDefinition;

  /**
   * Application this property belongs to (ADR-6 explicit scoping).
   * Always equals the parent collection's applicationId at creation
   * time, but kept as a denormalized FK so cross-application reference
   * checks don't require an extra join through collections.
   */
  @Column({ name: 'application_id', type: 'uuid', nullable: true })
  applicationId?: string | null;

  // ─────────────────────────────────────────────────────────────────
  // Identity
  // ─────────────────────────────────────────────────────────────────

  /** Unique property code within the collection */
  @Column({ type: 'varchar', length: 100 })
  code!: string;

  /** Display name */
  @Column({ type: 'varchar', length: 255 })
  name!: string;

  /** Description */
  @Column({ type: 'text', nullable: true })
  description?: string | null;

  // ─────────────────────────────────────────────────────────────────
  // Type Configuration
  // ─────────────────────────────────────────────────────────────────

  /** Property type */
  @Column({ name: 'property_type_id', type: 'uuid' })
  propertyTypeId!: string;

  @ManyToOne(() => PropertyType)
  @JoinColumn({ name: 'property_type_id' })
  propertyType?: PropertyType;

  /** Actual database column name */
  @Column({ name: 'column_name', type: 'varchar', length: 100 })
  columnName!: string;

  /** Type-specific configuration */
  @Column({ type: 'jsonb', default: () => `'{}'` })
  config!: Record<string, unknown>;

  // ─────────────────────────────────────────────────────────────────
  // Validation
  // ─────────────────────────────────────────────────────────────────

  /** Is required */
  @Column({ name: 'is_required', type: 'boolean', default: false })
  isRequired!: boolean;

  /** Is unique */
  @Column({ name: 'is_unique', type: 'boolean', default: false })
  isUnique!: boolean;

  /** Is indexed */
  @Column({ name: 'is_indexed', type: 'boolean', default: false })
  isIndexed!: boolean;

  /** Validation rules */
  @Column({ name: 'validation_rules', type: 'jsonb', default: () => `'{}'` })
  validationRules!: Record<string, unknown>;

  // ─────────────────────────────────────────────────────────────────
  // Default Value
  // ─────────────────────────────────────────────────────────────────

  /** Default value */
  @Column({ name: 'default_value', type: 'text', nullable: true })
  defaultValue?: string | null;

  /** Default value type */
  @Column({ name: 'default_value_type', type: 'varchar', length: 50, default: 'static' })
  defaultValueType!: DefaultValueType;

  // ─────────────────────────────────────────────────────────────────
  // Display
  // ─────────────────────────────────────────────────────────────────

  /** Display order */
  @Column({ type: 'integer', default: 0 })
  position!: number;

  /** Is visible in UI */
  @Column({ name: 'is_visible', type: 'boolean', default: true })
  isVisible!: boolean;

  /** Is read-only in UI */
  @Column({ name: 'is_readonly', type: 'boolean', default: false })
  isReadonly!: boolean;

  /** Display format (e.g., date format, number format) */
  @Column({ name: 'display_format', type: 'varchar', length: 100, nullable: true })
  displayFormat?: string | null;

  /** Placeholder text */
  @Column({ type: 'varchar', length: 255, nullable: true })
  placeholder?: string | null;

  /** Help text */
  @Column({ name: 'help_text', type: 'text', nullable: true })
  helpText?: string | null;

  // ─────────────────────────────────────────────────────────────────
  // Reference Configuration (for reference types)
  // ─────────────────────────────────────────────────────────────────

  /** Referenced collection (for reference type) */
  @Column({ name: 'reference_collection_id', type: 'uuid', nullable: true })
  referenceCollectionId?: string | null;

  @ManyToOne(() => CollectionDefinition, { nullable: true })
  @JoinColumn({ name: 'reference_collection_id' })
  referenceCollection?: CollectionDefinition | null;

  /** Property to display from referenced record */
  @Column({ name: 'reference_display_property', type: 'varchar', length: 100, nullable: true })
  referenceDisplayProperty?: string | null;

  /** Filter for reference lookup */
  @Column({ name: 'reference_filter', type: 'jsonb', nullable: true })
  referenceFilter?: Record<string, unknown> | null;

  // ─────────────────────────────────────────────────────────────────
  // Choice Configuration (for choice types)
  // ─────────────────────────────────────────────────────────────────

  /** Choice list ID */
  @Column({ name: 'choice_list_id', type: 'uuid', nullable: true })
  choiceListId?: string | null;

  // ─────────────────────────────────────────────────────────────────
  // Ownership
  // ─────────────────────────────────────────────────────────────────

  /** Owner type (system, module, or custom) */
  @Column({ name: 'owner_type', type: 'varchar', length: 20, default: 'custom' })
  ownerType!: OwnerType;

  // ─────────────────────────────────────────────────────────────────
  // Flags
  // ─────────────────────────────────────────────────────────────────

  /** System property (cannot be deleted) */
  @Column({ name: 'is_system', type: 'boolean', default: false })
  isSystem!: boolean;

  /** Active status */
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  /** ADR-7 provenance. See CollectionDefinition.source for semantics. */
  @Column({ name: 'source', type: 'varchar', length: 120, default: 'custom' })
  source!: string;

  /** Is searchable (included in full-text search) */
  @Column({ name: 'is_searchable', type: 'boolean', default: false })
  isSearchable!: boolean;

  /** Is sortable */
  @Column({ name: 'is_sortable', type: 'boolean', default: true })
  isSortable!: boolean;

  /** Is filterable */
  @Column({ name: 'is_filterable', type: 'boolean', default: true })
  isFilterable!: boolean;

  // ─────────────────────────────────────────────────────────────────
  // Sensitive Data & Security
  // ─────────────────────────────────────────────────────────────────

  /** Contains Protected Health Information (PHI/HIPAA) */
  @Column({ name: 'is_phi', type: 'boolean', default: false })
  isPhi!: boolean;

  /** Contains Personally Identifiable Information (PII) */
  @Column({ name: 'is_pii', type: 'boolean', default: false })
  isPii!: boolean;

  /** Contains sensitive data requiring masking */
  @Column({ name: 'is_sensitive', type: 'boolean', default: false })
  isSensitive!: boolean;

  /** Masking strategy for sensitive data */
  @Column({ name: 'masking_strategy', type: 'varchar', length: 20, default: 'none' })
  maskingStrategy!: 'none' | 'partial' | 'full';

  /** Custom mask value (e.g., '****' or 'REDACTED') */
  @Column({ name: 'mask_value', type: 'varchar', length: 50, nullable: true })
  maskValue?: string | null;

  /** Requires break-glass access for viewing */
  @Column({ name: 'requires_break_glass', type: 'boolean', default: false })
  requiresBreakGlass!: boolean;

  /**
   * Behavioral attributes registry (plan §6.3). A typed JSONB bag the
   * platform's runtime hooks read to decide property-level behavior:
   *
   *   - `encrypt_at_rest`  : route through libs/shared-types
   *                          encryption.service before storage
   *   - `audit`            : add to audit-log subscriber's tracked-
   *                          changes set
   *   - `mask_in_logs`     : redact in notification.service
   *                          provider-error patterns
   *   - `mobile_visible`   : surface on the mobile shell
   *   - `formula_cache_strategy` : computed-property caching policy
   *
   * Values are typed via PropertyBehavioralAttributes; persistence is
   * a flat JSONB so future attributes don't require schema migrations.
   */
  @Column({
    name: 'behavioral_attributes',
    type: 'jsonb',
    default: () => `'{}'::jsonb`,
  })
  behavioralAttributes!: PropertyBehavioralAttributes;

  // ─────────────────────────────────────────────────────────────────
  // Metadata
  // ─────────────────────────────────────────────────────────────────

  /** Additional metadata */
  @Column({ type: 'jsonb', default: () => `'{}'` })
  metadata!: Record<string, unknown>;

  // ─────────────────────────────────────────────────────────────────
  // Lifecycle (ADR-5)
  // ─────────────────────────────────────────────────────────────────

  /** Current lifecycle state of this property definition. */
  @Column({ type: 'varchar', length: 20, default: 'draft' })
  status!: PropertyDefinitionStatus;

  /** The revision the property currently advertises as canonical. */
  @Column({ name: 'current_revision_id', type: 'uuid', nullable: true })
  currentRevisionId?: string | null;

  /** When the most recent publish happened (null while draft). */
  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt?: Date | null;

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

/**
 * PropertyDefinitionRevision — append-only edit history for a Property
 * definition. Mirrors CollectionDefinitionRevision and ApplicationRevision
 * so the lifecycle pattern is uniform across metadata entities (ADR-5).
 */
@Entity({ name: 'property_definition_revisions', schema: 'metadata' })
@Index(['propertyId'])
@Index(['status'])
@Index(['propertyId', 'revision'], { unique: true })
export class PropertyDefinitionRevision {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'property_id', type: 'uuid' })
  propertyId!: string;

  @ManyToOne(() => PropertyDefinition, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'property_id' })
  property?: PropertyDefinition;

  @Column({ name: 'revision', type: 'integer' })
  revision!: number;

  @Column({ name: 'status', type: 'varchar', length: 20 })
  status!: PropertyDefinitionRevisionStatus;

  /**
   * Snapshot of the property's authoring fields at this revision.
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
