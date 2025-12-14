import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';

@Entity('collection_definitions')
@Index(['code'], { unique: true })
@Index(['moduleId'])
@Index(['extendsCollectionId'])
@Index(['category'])
@Index(['isSystem'])
export class CollectionDefinition {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Unique code identifier (e.g., 'incident', 'asset', 'user') */
  @Column({ type: 'varchar', length: 100 })
  code!: string;

  /** Display label */
  @Column({ type: 'varchar', length: 200 })
  label!: string;

  /** Plural form of label */
  @Column({ name: 'label_plural', type: 'varchar', length: 200, nullable: true })
  labelPlural?: string | null;

  /** Description of the collection */
  @Column({ type: 'text', nullable: true })
  description?: string | null;

  /** Icon name (Lucide icon) */
  @Column({ type: 'varchar', length: 50, nullable: true })
  icon?: string | null;

  /** Brand color for the collection */
  @Column({ type: 'varchar', length: 20, nullable: true })
  color?: string | null;

  /** Actual database table name for storing records */
  @Column({ name: 'storage_table', type: 'varchar', length: 100 })
  storageTable!: string;

  /** System collections cannot be deleted or have code changed */
  @Column({ name: 'is_system', type: 'boolean', default: false })
  isSystem!: boolean;

  /** Can tenant admins add custom properties to this collection */
  @Column({ name: 'is_extensible', type: 'boolean', default: true })
  isExtensible!: boolean;

  /** Should changes be tracked in audit log */
  @Column({ name: 'is_audited', type: 'boolean', default: true })
  isAudited!: boolean;

  /** Enable version history for records */
  @Column({ name: 'is_versioned', type: 'boolean', default: false })
  isVersioned!: boolean;

  /** Parent collection for inheritance */
  @Column({ name: 'extends_collection_id', type: 'uuid', nullable: true })
  extendsCollectionId?: string | null;

  @ManyToOne(() => CollectionDefinition, { nullable: true })
  @JoinColumn({ name: 'extends_collection_id' })
  extendsCollection?: CollectionDefinition | null;

  @OneToMany(() => CollectionDefinition, (c) => c.extendsCollection)
  childCollections?: CollectionDefinition[];

  /** Module this collection belongs to */
  @Column({ name: 'module_id', type: 'uuid', nullable: true })
  moduleId?: string | null;

  /** Property to display as the record's title */
  @Column({ name: 'display_property_id', type: 'uuid', nullable: true })
  displayPropertyId?: string | null;

  /** Property used as unique identifier (number, code, etc.) */
  @Column({ name: 'identifier_property_id', type: 'uuid', nullable: true })
  identifierPropertyId?: string | null;

  /** Logical grouping/category */
  @Column({ type: 'varchar', length: 100, nullable: true })
  category?: string | null;

  /** Tags for filtering/searching */
  @Column({ type: 'jsonb', default: () => `'[]'` })
  tags!: string[];

  /** Custom metadata */
  @Column({ type: 'jsonb', default: () => `'{}'` })
  metadata!: Record<string, unknown>;

  /** Display order in lists */
  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  /** Schema version for migrations */
  @Column({ type: 'int', default: 1 })
  version!: number;

  /** When this schema was published */
  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt?: Date | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy?: string | null;

  /** Soft delete */
  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
