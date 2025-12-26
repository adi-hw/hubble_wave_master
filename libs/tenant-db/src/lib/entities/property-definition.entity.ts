import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { CollectionDefinition, SchemaOwner, SyncStatus } from './collection-definition.entity';

/**
 * HubbleWave data types supported for properties.
 * Each type maps to a PostgreSQL storage type but includes additional
 * application-level semantics for validation, UI rendering, and behavior.
 */
export type PropertyDataType =
  | 'text'           // VARCHAR - Short text, single line
  | 'long_text'      // TEXT - Multi-line, unlimited length
  | 'rich_text'      // TEXT - HTML/Markdown content
  | 'number'         // NUMERIC - Decimal numbers
  | 'integer'        // INTEGER - Whole numbers
  | 'decimal'        // NUMERIC(19,4) - High precision decimals
  | 'currency'       // NUMERIC(19,4) - Money with currency code
  | 'boolean'        // BOOLEAN - True/false
  | 'date'           // DATE - Date only, no time
  | 'datetime'       // TIMESTAMPTZ - Date and time with timezone
  | 'time'           // TIME - Time only
  | 'reference'      // UUID - Foreign key to another collection
  | 'multi_reference'// JSONB - Array of references (many-to-many)
  | 'choice'         // VARCHAR - Single selection from choice list
  | 'multi_choice'   // JSONB - Multiple selections from choice list
  | 'attachment'     // JSONB - File attachment references
  | 'json'           // JSONB - Arbitrary JSON data
  | 'email'          // VARCHAR - Email with validation
  | 'phone'          // VARCHAR - Phone with formatting
  | 'url'            // VARCHAR - URL with validation
  | 'uuid';          // UUID - Unique identifier

/**
 * PropertyDefinition Entity
 * 
 * Represents a field/column within a collection. Each property maps to a
 * physical PostgreSQL column (via storage_column) but adds rich metadata
 * that PostgreSQL cannot express: display labels, UI widgets, validation
 * rules, help text, and governance controls.
 * 
 * Key design principles:
 * 
 * 1. **Separation of Concerns**: The `code` is the application identifier
 *    while `storage_column` is the physical column name. These can differ
 *    to handle legacy schemas or naming conflicts.
 * 
 * 2. **Virtual Properties**: Some properties (computed, rollup) have no
 *    storage_column because they're derived at query time.
 * 
 * 3. **Governance**: The `owner` field determines who can modify this property.
 *    Custom properties on platform collections must use the x_ prefix.
 * 
 * @example
 * ```typescript
 * // Adding a custom property to a platform collection
 * const property = await collectionService.addProperty('users', {
 *   code: 'badge_number',  // Will become x_badge_number in storage
 *   label: 'Badge Number',
 *   dataType: 'text',
 * }, { userId: currentUser.id });
 * ```
 */
@Entity('property_definition')
@Index('idx_property_collection_code', ['collection', 'code'], { unique: true })
@Index('idx_property_owner', ['owner'])
@Index('idx_property_sync_status', ['syncStatus'])
@Index('idx_property_collection_owner', ['collection', 'owner'])
@Index('idx_property_display_order', ['collection', 'displayOrder'])
export class PropertyDefinition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ═══════════════════════════════════════════════════════════════════════════
  // IDENTIFICATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Internal code/identifier for this property. Used in APIs and code.
   * Must be lowercase snake_case: first_name, assigned_technician, etc.
   * For custom properties on platform collections, this is the user-facing
   * code (without x_ prefix), while storage_column has the actual column name.
   */
  @Column({ type: 'varchar', length: 100 })
  code: string;

  /**
   * Human-readable display label shown in forms and grids.
   * Example: "First Name", "Assigned Technician"
   */
  @Column({ type: 'varchar', length: 200 })
  label: string;

  /**
   * Optional description explaining the purpose of this field.
   * Shown in Studio schema editor.
   */
  @Column({ type: 'text', nullable: true })
  description: string;

  /**
   * Placeholder text shown in empty input fields.
   * Example: "Enter first name..."
   */
  @Column({ type: 'text', nullable: true })
  placeholder: string;

  /**
   * Help text shown below the field or in tooltips.
   * Example: "Legal first name as shown on government ID"
   */
  @Column({ type: 'text', name: 'help_text', nullable: true })
  helpText: string;

  // ═══════════════════════════════════════════════════════════════════════════
  // TYPE CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * HubbleWave data type that determines storage, validation, and UI behavior.
   */
  @Column({ type: 'varchar', length: 50, name: 'data_type' })
  dataType: PropertyDataType;

  /**
   * UI widget to use for rendering this field.
   * Can override the default widget for the data type.
   * Examples: 'text-input', 'textarea', 'rich-editor', 'select', 'radio', etc.
   */
  @Column({ type: 'varchar', length: 50, name: 'ui_widget', nullable: true })
  uiWidget: string;

  // ═══════════════════════════════════════════════════════════════════════════
  // PHYSICAL STORAGE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Name of the actual PostgreSQL column that stores this property's data.
   * For custom properties on platform collections, this includes the x_ prefix.
   * NULL for virtual (computed/rollup) properties that have no storage.
   */
  @Column({ type: 'varchar', length: 100, name: 'storage_column', nullable: true })
  storageColumn: string;

  /**
   * PostgreSQL data type for the storage column.
   * Examples: 'varchar', 'integer', 'timestamptz', 'jsonb', 'uuid'
   */
  @Column({ type: 'varchar', length: 50, name: 'storage_type', nullable: true })
  storageType: string;

  /**
   * True for computed/rollup properties that are calculated, not stored.
   * These properties have no storage_column.
   */
  @Column({ type: 'boolean', name: 'is_virtual', default: false })
  isVirtual: boolean;

  /**
   * SQL or JavaScript expression for computed properties.
   * Only used when is_virtual is true.
   */
  @Column({ type: 'text', name: 'virtual_expression', nullable: true })
  virtualExpression: string;

  // ═══════════════════════════════════════════════════════════════════════════
  // VALIDATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Whether this field must have a value when saving.
   */
  @Column({ type: 'boolean', name: 'is_required', default: false })
  isRequired: boolean;

  /**
   * Whether values must be unique across all records.
   */
  @Column({ type: 'boolean', name: 'is_unique', default: false })
  isUnique: boolean;

  /**
   * Minimum allowed numeric value (for number/integer/decimal types).
   */
  @Column({ type: 'numeric', name: 'min_value', nullable: true })
  minValue: number;

  /**
   * Maximum allowed numeric value (for number/integer/decimal types).
   */
  @Column({ type: 'numeric', name: 'max_value', nullable: true })
  maxValue: number;

  /**
   * Minimum string length (for text types).
   */
  @Column({ type: 'integer', name: 'min_length', nullable: true })
  minLength: number;

  /**
   * Maximum string length (for text types).
   */
  @Column({ type: 'integer', name: 'max_length', nullable: true })
  maxLength: number;

  /**
   * Regular expression pattern for validation (for text types).
   * Example: "^[A-Z]{2}[0-9]{6}$" for ID codes
   */
  @Column({ type: 'varchar', length: 500, nullable: true })
  pattern: string;

  /**
   * Custom error message when pattern validation fails.
   */
  @Column({ type: 'varchar', length: 200, name: 'pattern_message', nullable: true })
  patternMessage: string;

  /**
   * JavaScript function for custom validation.
   * Receives (value, record, context) and should return true or error message.
   */
  @Column({ type: 'text', name: 'custom_validator', nullable: true })
  customValidator: string;

  /**
   * Additional validation rules as JSON.
   * Used for complex conditional validations.
   */
  @Column({ type: 'jsonb', name: 'validation_rules', nullable: true })
  validationRules: Record<string, any>;

  // ═══════════════════════════════════════════════════════════════════════════
  // REFERENCE CONFIGURATION (for reference/multi_reference types)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Target collection for reference types.
   */
  @Column({ type: 'uuid', name: 'reference_collection_id', nullable: true })
  referenceCollectionId: string;

  /**
   * Property to display when showing referenced records.
   * Example: "name" to show user names instead of IDs.
   */
  @Column({ type: 'varchar', length: 100, name: 'reference_display_property', nullable: true })
  referenceDisplayProperty: string;

  /**
   * JSON filter to limit which records can be referenced.
   * Example: {"status": "active"} to only show active records.
   */
  @Column({ type: 'jsonb', name: 'reference_filter', nullable: true })
  referenceFilter: Record<string, any>;

  // ═══════════════════════════════════════════════════════════════════════════
  // CHOICE CONFIGURATION (for choice/multi_choice types)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Reference to a reusable choice list.
   */
  @Column({ type: 'uuid', name: 'choice_list_id', nullable: true })
  choiceListId: string;

  /**
   * Inline choice options if not using a choice list.
   * Array of {value, label, color?, icon?} objects.
   */
  @Column({ type: 'jsonb', nullable: true })
  choices: Array<{
    value: string;
    label: string;
    color?: string;
    icon?: string;
  }>;

  /**
   * For multi_choice: whether multiple selections are allowed.
   */
  @Column({ type: 'boolean', name: 'allow_multiple', default: false })
  allowMultiple: boolean;

  // ═══════════════════════════════════════════════════════════════════════════
  // DEFAULT VALUE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Static default value for new records.
   * Stored as string, parsed according to data type.
   */
  @Column({ type: 'text', name: 'default_value', nullable: true })
  defaultValue: string;

  /**
   * JavaScript expression for dynamic defaults.
   * Examples: "new Date()", "context.currentUser.id", "generateSequence('WO')"
   */
  @Column({ type: 'text', name: 'default_expression', nullable: true })
  defaultExpression: string;

  // ═══════════════════════════════════════════════════════════════════════════
  // DISPLAY CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Order in which this property appears in forms and lists.
   * Lower numbers appear first.
   */
  @Column({ type: 'integer', name: 'display_order', default: 0 })
  displayOrder: number;

  /**
   * Whether to show this property in list/grid views by default.
   */
  @Column({ type: 'boolean', name: 'show_in_grid', default: true })
  showInGrid: boolean;

  /**
   * Whether to show this property in detail/form views by default.
   */
  @Column({ type: 'boolean', name: 'show_in_detail', default: true })
  showInDetail: boolean;

  /**
   * Whether to show this property in the create form.
   */
  @Column({ type: 'boolean', name: 'show_in_create', default: true })
  showInCreate: boolean;

  /**
   * Default width for grid columns (pixels).
   */
  @Column({ type: 'integer', name: 'grid_width', nullable: true })
  gridWidth: number;

  /**
   * Priority for mobile display (1-100, higher = more important).
   * Properties with low priority may be hidden on mobile.
   */
  @Column({ type: 'integer', name: 'mobile_priority', default: 50 })
  mobilePriority: number;

  /**
   * Override UI widget for mobile rendering.
   */
  @Column({ type: 'varchar', length: 50, name: 'mobile_widget', nullable: true })
  mobileWidget: string;

  /**
   * Whether this property can be collapsed/hidden in detail views.
   */
  @Column({ type: 'boolean', default: false })
  collapsible: boolean;

  // ═══════════════════════════════════════════════════════════════════════════
  // ACCESS CONTROL
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * If true, this property can be viewed but not edited by regular users.
   */
  @Column({ type: 'boolean', name: 'is_readonly', default: false })
  isReadonly: boolean;

  /**
   * System properties are managed by the platform, not visible in Schema editor.
   */
  @Column({ type: 'boolean', name: 'is_system', default: false })
  isSystem: boolean;

  /**
   * Internal properties are hidden from regular users, visible to admins only.
   */
  @Column({ type: 'boolean', name: 'is_internal', default: false })
  isInternal: boolean;

  // ═══════════════════════════════════════════════════════════════════════════
  // GOVERNANCE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Ownership determines what modifications are allowed.
   * For properties on platform collections, 'custom' means tenant-added (with x_ prefix).
   */
  @Column({ 
    type: 'enum', 
    enum: ['system', 'platform', 'custom'],
    default: 'custom' 
  })
  owner: SchemaOwner;

  /**
   * Current sync status between metadata and physical column.
   */
  @Column({ 
    type: 'enum', 
    enum: ['synced', 'pending', 'error', 'orphaned'],
    name: 'sync_status',
    default: 'synced' 
  })
  syncStatus: SyncStatus;

  /**
   * Error message if sync_status is 'error'.
   */
  @Column({ type: 'text', name: 'sync_error', nullable: true })
  syncError: string;

  /**
   * Hard lock preventing any modifications.
   */
  @Column({ type: 'boolean', name: 'is_locked', default: false })
  isLocked: boolean;

  /**
   * Platform version when this property was created/modified.
   */
  @Column({ type: 'varchar', length: 20, name: 'platform_version', nullable: true })
  platformVersion: string;

  /**
   * Required prefix for custom properties on platform collections.
   * Default is 'x_' to prevent collision with future platform properties.
   */
  @Column({ type: 'varchar', length: 10, name: 'custom_property_prefix', default: 'x_' })
  customPropertyPrefix: string;

  // ═══════════════════════════════════════════════════════════════════════════
  // CONDITIONAL REQUIREMENTS (Smart Field Handling)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Condition when this field becomes required.
   * Example: {"property": "status", "operator": "equals", "value": "approved"}
   */
  @Column({ type: 'jsonb', name: 'required_when', nullable: true })
  requiredWhen: Record<string, any>;

  /**
   * Custom title for the prompt shown when this hidden field is required.
   */
  @Column({ type: 'varchar', length: 200, name: 'prompt_title', nullable: true })
  promptTitle: string;

  /**
   * Description for the prompt shown when this hidden field is required.
   */
  @Column({ type: 'text', name: 'prompt_description', nullable: true })
  promptDescription: string;

  /**
   * Whether this field can be hidden by users.
   * False = must always be visible in forms.
   */
  @Column({ type: 'boolean', name: 'can_be_hidden', default: true })
  canBeHidden: boolean;

  /**
   * How to prompt for this field when hidden but required.
   * 'modal' = show in popup, 'inline' = expand inline, 'block' = prevent save
   */
  @Column({ type: 'varchar', length: 20, name: 'hidden_prompt_mode', default: 'modal' })
  hiddenPromptMode: 'modal' | 'inline' | 'block';

  /**
   * Whether to auto-fill this field when hidden (if possible).
   */
  @Column({ type: 'boolean', name: 'auto_fill_when_hidden', default: false })
  autoFillWhenHidden: boolean;

  /**
   * Expression to compute auto-fill value.
   * Example: "context.currentUser.id" for current user fields.
   */
  @Column({ type: 'text', name: 'auto_fill_expression', nullable: true })
  autoFillExpression: string;

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
   * Parent collection this property belongs to.
   */
  @ManyToOne(() => CollectionDefinition, (collection) => collection.properties, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'collection_id' })
  collection: CollectionDefinition;

  @Column({ type: 'uuid', name: 'collection_id' })
  collectionId: string;

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPER METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Returns true if this property can be deleted by tenants.
   */
  canBeDeleted(): boolean {
    return this.owner === 'custom' && !this.isLocked && !this.isSystem;
  }

  /**
   * Returns true if this property can be modified by tenants.
   */
  canBeModified(): boolean {
    return this.owner === 'custom' && !this.isLocked;
  }

  /**
   * Returns true if this is a virtual (computed) property with no storage.
   */
  hasStorage(): boolean {
    return !this.isVirtual && this.storageColumn != null;
  }

  /**
   * Returns the storage column name, accounting for prefixes.
   */
  getStorageColumn(): string | null {
    return this.storageColumn;
  }

  /**
   * Checks if a value passes this property's validation rules.
   * This is a simplified version; full validation happens in ValidationService.
   */
  validateValue(value: any): { valid: boolean; error?: string } {
    // Required check
    if (this.isRequired && (value === null || value === undefined || value === '')) {
      return { valid: false, error: `${this.label} is required` };
    }

    // Skip other validations if value is empty (and not required)
    if (value === null || value === undefined || value === '') {
      return { valid: true };
    }

    // Min/max for numbers
    if (['number', 'integer', 'decimal', 'currency'].includes(this.dataType)) {
      const num = Number(value);
      if (this.minValue !== null && num < this.minValue) {
        return { valid: false, error: `${this.label} must be at least ${this.minValue}` };
      }
      if (this.maxValue !== null && num > this.maxValue) {
        return { valid: false, error: `${this.label} must be at most ${this.maxValue}` };
      }
    }

    // Length for strings
    if (['text', 'long_text', 'email', 'phone', 'url'].includes(this.dataType)) {
      const str = String(value);
      if (this.minLength !== null && str.length < this.minLength) {
        return { valid: false, error: `${this.label} must be at least ${this.minLength} characters` };
      }
      if (this.maxLength !== null && str.length > this.maxLength) {
        return { valid: false, error: `${this.label} must be at most ${this.maxLength} characters` };
      }
    }

    // Pattern validation
    if (this.pattern) {
      const regex = new RegExp(this.pattern);
      if (!regex.test(String(value))) {
        return { valid: false, error: this.patternMessage || `${this.label} has invalid format` };
      }
    }

    return { valid: true };
  }
}
