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
import { CollectionDefinition } from './collection-definition.entity';

export type ViewType = 'list' | 'board' | 'calendar' | 'timeline' | 'card' | 'hierarchy';

export interface SortConfig {
  propertyCode: string;
  direction: 'asc' | 'desc';
}

export interface FilterCondition {
  propertyCode: string;
  operator: string;
  value?: unknown;
  values?: unknown[];
}

export interface QuickFilter {
  propertyCode: string;
  label: string;
  icon?: string;
}

export interface RowAction {
  code: string;
  label: string;
  icon?: string;
  variant?: 'primary' | 'secondary' | 'danger';
  confirmMessage?: string;
  conditions?: FilterCondition[];
}

export interface BoardConfig {
  groupByProperty: string;
  swimlaneProperty?: string;
  cardTitleProperty: string;
  cardDescriptionProperty?: string;
  cardColorProperty?: string;
  columnOrder?: string[];
}

export interface CalendarConfig {
  startDateProperty: string;
  endDateProperty?: string;
  titleProperty: string;
  colorProperty?: string;
  allDayProperty?: string;
}

export interface TimelineConfig {
  startDateProperty: string;
  endDateProperty: string;
  titleProperty: string;
  groupByProperty?: string;
  colorProperty?: string;
}

@Entity('view_definitions')
@Index(['collectionId'])
@Index(['collectionId', 'code'], { unique: true })
@Index(['viewType'])
@Index(['collectionId', 'isDefault'])
@Index(['ownerId'])
export class ViewDefinition {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Parent collection */
  @Column({ name: 'collection_id', type: 'uuid' })
  collectionId!: string;

  @ManyToOne(() => CollectionDefinition, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'collection_id' })
  collection?: CollectionDefinition;

  /** Unique code for this view */
  @Column({ type: 'varchar', length: 100 })
  code!: string;

  /** Display label */
  @Column({ type: 'varchar', length: 200 })
  label!: string;

  /** Description */
  @Column({ type: 'text', nullable: true })
  description?: string | null;

  /** Type of view */
  @Column({ name: 'view_type', type: 'varchar', length: 30, default: 'list' })
  viewType!: ViewType;

  /** Is this the default view for the collection */
  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault!: boolean;

  /** System views cannot be deleted */
  @Column({ name: 'is_system', type: 'boolean', default: false })
  isSystem!: boolean;

  /** Personal views are only visible to the owner */
  @Column({ name: 'is_personal', type: 'boolean', default: false })
  isPersonal!: boolean;

  /** Owner for personal views */
  @Column({ name: 'owner_id', type: 'uuid', nullable: true })
  ownerId?: string | null;

  /** Role IDs that can access this view */
  @Column({ name: 'role_ids', type: 'jsonb', default: () => `'[]'` })
  roleIds!: string[];

  /** Filter conditions applied to this view */
  @Column({ type: 'jsonb', default: () => `'[]'` })
  conditions!: FilterCondition[];

  /** Default sort configuration */
  @Column({ name: 'sort_config', type: 'jsonb', default: () => `'[]'` })
  sortConfig!: SortConfig[];

  /** Property to group by */
  @Column({ name: 'group_by', type: 'varchar', length: 100, nullable: true })
  groupBy?: string | null;

  /** Default page size */
  @Column({ name: 'page_size', type: 'int', default: 20 })
  pageSize!: number;

  /** Quick filter buttons */
  @Column({ name: 'quick_filters', type: 'jsonb', default: () => `'[]'` })
  quickFilters!: QuickFilter[];

  /** Saved filter presets for this view */
  @Column({ name: 'saved_filters', type: 'jsonb', default: () => `'[]'` })
  savedFilters!: string[];

  /** Row-level actions */
  @Column({ name: 'row_actions', type: 'jsonb', default: () => `'[]'` })
  rowActions!: RowAction[];

  /** Bulk actions */
  @Column({ name: 'bulk_actions', type: 'jsonb', default: () => `'[]'` })
  bulkActions!: RowAction[];

  /** Card view configuration */
  @Column({ name: 'card_config', type: 'jsonb', nullable: true })
  cardConfig?: Record<string, unknown> | null;

  /** Board view configuration */
  @Column({ name: 'board_config', type: 'jsonb', nullable: true })
  boardConfig?: BoardConfig | null;

  /** Calendar view configuration */
  @Column({ name: 'calendar_config', type: 'jsonb', nullable: true })
  calendarConfig?: CalendarConfig | null;

  /** Timeline view configuration */
  @Column({ name: 'timeline_config', type: 'jsonb', nullable: true })
  timelineConfig?: TimelineConfig | null;

  /** Custom metadata */
  @Column({ type: 'jsonb', default: () => `'{}'` })
  metadata!: Record<string, unknown>;

  /** Display order */
  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  /** Schema version */
  @Column({ type: 'int', default: 1 })
  version!: number;

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

  // Relations
  @OneToMany('ViewColumn', 'view')
  columns?: import('./view-column.entity').ViewColumn[];
}
