import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { CollectionDefinition } from './collection-definition.entity';

export type PropertyType =
  | 'string'
  | 'text'
  | 'rich_text'
  | 'email'
  | 'url'
  | 'phone'
  | 'integer'
  | 'decimal'
  | 'currency'
  | 'percent'
  | 'date'
  | 'datetime'
  | 'time'
  | 'duration'
  | 'choice'
  | 'multi_choice'
  | 'boolean'
  | 'reference'
  | 'multi_reference'
  | 'user'
  | 'group'
  | 'attachment'
  | 'image'
  | 'json'
  | 'script'
  | 'formula'
  | 'conditions'
  | 'glide_list';

export type ChoiceType = 'static' | 'dynamic' | 'dependent';

export type UiWidth = 'quarter' | 'third' | 'half' | 'two_thirds' | 'three_quarters' | 'full';

export interface ChoiceOption {
  value: string;
  label: string;
  color?: string;
  icon?: string;
  dependsOnValue?: string;
  sortOrder?: number;
  isDefault?: boolean;
  isInactive?: boolean;
}

@Entity('property_definitions')
@Index(['collectionId'])
@Index(['collectionId', 'code'], { unique: true })
@Index(['propertyType'])
@Index(['referenceCollectionId'])
@Index(['isSystem'])
@Index(['collectionId', 'groupName'])
export class PropertyDefinition {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Parent collection */
  @Column({ name: 'collection_id', type: 'uuid' })
  collectionId!: string;

  @ManyToOne(() => CollectionDefinition, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'collection_id' })
  collection?: CollectionDefinition;

  /** Unique code within collection (e.g., 'short_description', 'state') */
  @Column({ type: 'varchar', length: 100 })
  code!: string;

  /** Display label */
  @Column({ type: 'varchar', length: 200 })
  label!: string;

  /** Help text description */
  @Column({ type: 'text', nullable: true })
  description?: string | null;

  /** Property data type */
  @Column({ name: 'property_type', type: 'varchar', length: 50 })
  propertyType!: PropertyType;

  /** Actual database column name */
  @Column({ name: 'storage_column', type: 'varchar', length: 100 })
  storageColumn!: string;

  // Flags
  @Column({ name: 'is_system', type: 'boolean', default: false })
  isSystem!: boolean;

  @Column({ name: 'is_required', type: 'boolean', default: false })
  isRequired!: boolean;

  @Column({ name: 'is_unique', type: 'boolean', default: false })
  isUnique!: boolean;

  @Column({ name: 'is_indexed', type: 'boolean', default: false })
  isIndexed!: boolean;

  @Column({ name: 'is_searchable', type: 'boolean', default: true })
  isSearchable!: boolean;

  @Column({ name: 'is_filterable', type: 'boolean', default: true })
  isFilterable!: boolean;

  @Column({ name: 'is_sortable', type: 'boolean', default: true })
  isSortable!: boolean;

  @Column({ name: 'is_readonly', type: 'boolean', default: false })
  isReadonly!: boolean;

  @Column({ name: 'is_computed', type: 'boolean', default: false })
  isComputed!: boolean;

  @Column({ name: 'is_encrypted', type: 'boolean', default: false })
  isEncrypted!: boolean;

  @Column({ name: 'is_internal', type: 'boolean', default: false })
  isInternal!: boolean;

  // Validation constraints
  @Column({ name: 'max_length', type: 'int', nullable: true })
  maxLength?: number | null;

  @Column({ name: 'min_value', type: 'decimal', nullable: true })
  minValue?: number | null;

  @Column({ name: 'max_value', type: 'decimal', nullable: true })
  maxValue?: number | null;

  @Column({ name: 'precision_value', type: 'int', nullable: true })
  precisionValue?: number | null;

  @Column({ name: 'scale_value', type: 'int', nullable: true })
  scaleValue?: number | null;

  /** Default value as JSON */
  @Column({ name: 'default_value', type: 'jsonb', nullable: true })
  defaultValue?: unknown;

  /** Formula for computed fields */
  @Column({ name: 'computed_formula', type: 'text', nullable: true })
  computedFormula?: string | null;

  /** Regex validation pattern */
  @Column({ name: 'validation_regex', type: 'varchar', length: 500, nullable: true })
  validationRegex?: string | null;

  /** Error message for validation */
  @Column({ name: 'validation_message', type: 'varchar', length: 500, nullable: true })
  validationMessage?: string | null;

  /** Help text shown below field */
  @Column({ name: 'hint_text', type: 'varchar', length: 500, nullable: true })
  hintText?: string | null;

  /** Placeholder text for input */
  @Column({ type: 'varchar', length: 200, nullable: true })
  placeholder?: string | null;

  // Reference configuration
  @Column({ name: 'reference_collection_id', type: 'uuid', nullable: true })
  referenceCollectionId?: string | null;

  @ManyToOne(() => CollectionDefinition, { nullable: true })
  @JoinColumn({ name: 'reference_collection_id' })
  referenceCollection?: CollectionDefinition | null;

  /** Property to display from referenced record */
  @Column({ name: 'reference_display_property', type: 'varchar', length: 100, nullable: true })
  referenceDisplayProperty?: string | null;

  /** Filter conditions for reference lookup */
  @Column({ name: 'reference_filter', type: 'jsonb', nullable: true })
  referenceFilter?: Record<string, unknown> | null;

  // Choice configuration
  @Column({ name: 'choice_list', type: 'jsonb', nullable: true })
  choiceList?: ChoiceOption[] | null;

  @Column({ name: 'choice_type', type: 'varchar', length: 20, nullable: true })
  choiceType?: ChoiceType | null;

  /** Parent choice field for dependent choices */
  @Column({ name: 'choice_dependent_on', type: 'uuid', nullable: true })
  choiceDependentOn?: string | null;

  @ManyToOne(() => PropertyDefinition, { nullable: true })
  @JoinColumn({ name: 'choice_dependent_on' })
  choiceDependentOnProperty?: PropertyDefinition | null;

  // UI configuration
  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  /** Grouping within form */
  @Column({ name: 'group_name', type: 'varchar', length: 100, nullable: true })
  groupName?: string | null;

  /** Layout width */
  @Column({ name: 'ui_width', type: 'varchar', length: 20, default: 'full' })
  uiWidth!: UiWidth;

  /** Override default component */
  @Column({ name: 'ui_component', type: 'varchar', length: 50, nullable: true })
  uiComponent?: string | null;

  /** Additional UI options */
  @Column({ name: 'ui_options', type: 'jsonb', default: () => `'{}'` })
  uiOptions!: Record<string, unknown>;

  /** Schema version */
  @Column({ type: 'int', default: 1 })
  version!: number;

  /** Deprecation timestamp */
  @Column({ name: 'deprecated_at', type: 'timestamptz', nullable: true })
  deprecatedAt?: Date | null;

  /** Deprecation notice */
  @Column({ name: 'deprecation_message', type: 'text', nullable: true })
  deprecationMessage?: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy?: string | null;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
