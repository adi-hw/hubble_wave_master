import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export type PropertyTypeCategory =
  | 'text'
  | 'number'
  | 'datetime'
  | 'choice'
  | 'reference'
  | 'special';

export type StorageType =
  | 'varchar'
  | 'text'
  | 'integer'
  | 'decimal'
  | 'boolean'
  | 'date'
  | 'time'
  | 'timestamptz'
  | 'interval'
  | 'uuid'
  | 'jsonb';

@Entity('property_types')
@Index(['code'], { unique: true })
@Index(['category'])
export class PropertyTypeDefinition {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Unique type code */
  @Column({ type: 'varchar', length: 50 })
  code!: string;

  /** Display label */
  @Column({ type: 'varchar', length: 100 })
  label!: string;

  /** Description */
  @Column({ type: 'text', nullable: true })
  description?: string | null;

  /** Icon name (Lucide) */
  @Column({ type: 'varchar', length: 50, nullable: true })
  icon?: string | null;

  /** Grouping category */
  @Column({ type: 'varchar', length: 50 })
  category!: PropertyTypeCategory;

  /** Database storage type */
  @Column({ name: 'storage_type', type: 'varchar', length: 30 })
  storageType!: StorageType;

  /** Default UI component */
  @Column({ name: 'ui_component', type: 'varchar', length: 50 })
  uiComponent!: string;

  /** Can this type have a default value */
  @Column({ name: 'supports_default', type: 'boolean', default: true })
  supportsDefault!: boolean;

  /** Can this type have validation rules */
  @Column({ name: 'supports_validation', type: 'boolean', default: true })
  supportsValidation!: boolean;

  /** Can this type use choice lists */
  @Column({ name: 'supports_choices', type: 'boolean', default: false })
  supportsChoices!: boolean;

  /** Can this type reference other collections */
  @Column({ name: 'supports_reference', type: 'boolean', default: false })
  supportsReference!: boolean;

  /** Can this type be computed */
  @Column({ name: 'supports_computed', type: 'boolean', default: false })
  supportsComputed!: boolean;

  /** Can this type be encrypted at rest */
  @Column({ name: 'supports_encryption', type: 'boolean', default: false })
  supportsEncryption!: boolean;

  /** JSON Schema for type-specific configuration */
  @Column({ name: 'config_schema', type: 'jsonb', default: () => `'{}'` })
  configSchema!: Record<string, unknown>;

  /** Display order */
  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  /** Is this a built-in type */
  @Column({ name: 'is_system', type: 'boolean', default: true })
  isSystem!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
