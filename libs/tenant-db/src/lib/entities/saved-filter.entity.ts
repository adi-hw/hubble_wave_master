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
import { FilterCondition } from './view-definition.entity';

@Entity('saved_filters')
@Index(['collectionId'])
@Index(['collectionId', 'code'], { unique: true })
@Index(['ownerId'])
export class SavedFilter {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Parent collection */
  @Column({ name: 'collection_id', type: 'uuid' })
  collectionId!: string;

  @ManyToOne(() => CollectionDefinition, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'collection_id' })
  collection?: CollectionDefinition;

  /** Unique code for this filter */
  @Column({ type: 'varchar', length: 100 })
  code!: string;

  /** Display label */
  @Column({ type: 'varchar', length: 200 })
  label!: string;

  /** Description */
  @Column({ type: 'text', nullable: true })
  description?: string | null;

  /** System filters cannot be deleted */
  @Column({ name: 'is_system', type: 'boolean', default: false })
  isSystem!: boolean;

  /** Personal filters are only visible to the owner */
  @Column({ name: 'is_personal', type: 'boolean', default: false })
  isPersonal!: boolean;

  /** Owner for personal filters */
  @Column({ name: 'owner_id', type: 'uuid', nullable: true })
  ownerId?: string | null;

  /** Role IDs that can access this filter */
  @Column({ name: 'role_ids', type: 'jsonb', default: () => `'[]'` })
  roleIds!: string[];

  /** Filter conditions */
  @Column({ type: 'jsonb', default: () => `'[]'` })
  conditions!: FilterCondition[];

  /** Icon for the filter */
  @Column({ type: 'varchar', length: 50, nullable: true })
  icon?: string | null;

  /** Color for the filter */
  @Column({ type: 'varchar', length: 20, nullable: true })
  color?: string | null;

  /** Display order */
  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  /** Usage count for popularity sorting */
  @Column({ name: 'usage_count', type: 'int', default: 0 })
  usageCount!: number;

  /** Last time this filter was used */
  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true })
  lastUsedAt?: Date | null;

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
