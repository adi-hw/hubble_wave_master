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
  Unique,
} from 'typeorm';

// ============================================================
// PROPERTY TYPE ENTITY
// ============================================================

/**
 * Property type category
 */
export type PropertyTypeCategory = 
  | 'text'
  | 'numeric'
  | 'datetime'
  | 'choice'
  | 'reference'
  | 'media'
  | 'advanced';

/**
 * PropertyType entity - defines available data types for properties
 * 
 * These are seeded during instance setup and rarely changed.
 */
@Entity('property_types')
@Index(['code'], { unique: true })
@Index(['category'])
export class PropertyType {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Unique type code (e.g., 'string', 'integer', 'reference') */
  @Column({ type: 'varchar', length: 50, unique: true })
  code!: string;

  /** Display name */
  @Column({ type: 'varchar', length: 100 })
  name!: string;

  /** Category for grouping */
  @Column({ type: 'varchar', length: 50 })
  category!: PropertyTypeCategory;

  /** Description */
  @Column({ type: 'text', nullable: true })
  description?: string | null;

  // ─────────────────────────────────────────────────────────────────
  // Type Configuration
  // ─────────────────────────────────────────────────────────────────

  /** Base PostgreSQL type (varchar, integer, jsonb, etc.) */
  @Column({ name: 'base_type', type: 'varchar', length: 50 })
  baseType!: string;

  /** Default configuration for this type */
  @Column({ name: 'default_config', type: 'jsonb', default: () => `'{}'` })
  defaultConfig!: Record<string, unknown>;

  /** Validation rules for this type */
  @Column({ name: 'validation_rules', type: 'jsonb', default: () => `'{}'` })
  validationRules!: Record<string, unknown>;

  // ─────────────────────────────────────────────────────────────────
  // UI Configuration
  // ─────────────────────────────────────────────────────────────────

  /** Default widget to use */
  @Column({ name: 'default_widget', type: 'varchar', length: 50, nullable: true })
  defaultWidget?: string | null;

  /** Icon for UI display */
  @Column({ type: 'varchar', length: 50, nullable: true })
  icon?: string | null;

  // ─────────────────────────────────────────────────────────────────
  // Flags
  // ─────────────────────────────────────────────────────────────────

  /** System type (cannot be deleted) */
  @Column({ name: 'is_system', type: 'boolean', default: true })
  isSystem!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

// ============================================================
// CHOICE LIST ENTITY
// ============================================================

/**
 * ChoiceList entity - defines choice lists for choice-type properties
 */
@Entity('choice_lists')
@Index(['code'], { unique: true })
export class ChoiceList {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Unique list code */
  @Column({ type: 'varchar', length: 100, unique: true })
  code!: string;

  /** Display name */
  @Column({ type: 'varchar', length: 255 })
  name!: string;

  /** Description */
  @Column({ type: 'text', nullable: true })
  description?: string | null;

  // ─────────────────────────────────────────────────────────────────
  // Flags
  // ─────────────────────────────────────────────────────────────────

  /** System list (cannot be deleted) */
  @Column({ name: 'is_system', type: 'boolean', default: false })
  isSystem!: boolean;

  /** Active status */
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  // ─────────────────────────────────────────────────────────────────
  // Relations
  // ─────────────────────────────────────────────────────────────────

  @OneToMany(() => ChoiceItem, (item) => item.choiceList)
  items?: ChoiceItem[];

  // ─────────────────────────────────────────────────────────────────
  // Timestamps
  // ─────────────────────────────────────────────────────────────────

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

// ============================================================
// CHOICE ITEM ENTITY
// ============================================================

/**
 * ChoiceItem entity - defines items in a choice list
 */
@Entity('choice_items')
@Unique(['choiceListId', 'value'])
@Index(['choiceListId'])
export class ChoiceItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Choice list this item belongs to */
  @Column({ name: 'choice_list_id', type: 'uuid' })
  choiceListId!: string;

  @ManyToOne(() => ChoiceList, (list) => list.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'choice_list_id' })
  choiceList?: ChoiceList;

  /** Value stored in database */
  @Column({ type: 'varchar', length: 255 })
  value!: string;

  /** Display label */
  @Column({ type: 'varchar', length: 255 })
  label!: string;

  // ─────────────────────────────────────────────────────────────────
  // Display
  // ─────────────────────────────────────────────────────────────────

  /** Display order */
  @Column({ type: 'integer', default: 0 })
  position!: number;

  /** Color for UI display */
  @Column({ type: 'varchar', length: 50, nullable: true })
  color?: string | null;

  /** Icon for UI display */
  @Column({ type: 'varchar', length: 100, nullable: true })
  icon?: string | null;

  // ─────────────────────────────────────────────────────────────────
  // Flags
  // ─────────────────────────────────────────────────────────────────

  /** Is default selection */
  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault!: boolean;

  /** Active status */
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
