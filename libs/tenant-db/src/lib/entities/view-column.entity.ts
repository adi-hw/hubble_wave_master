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
import { ViewDefinition } from './view-definition.entity';
import { PropertyDefinition } from './property-definition.entity';

export type ColumnAlignment = 'left' | 'center' | 'right';

export type AggregateFunction = 'count' | 'sum' | 'avg' | 'min' | 'max' | 'distinct_count';

export type CellFormatter =
  | 'text'
  | 'number'
  | 'currency'
  | 'percent'
  | 'date'
  | 'datetime'
  | 'time'
  | 'boolean'
  | 'badge'
  | 'progress'
  | 'link'
  | 'avatar'
  | 'rating'
  | 'color';

export type CellRenderer =
  | 'default'
  | 'badge'
  | 'progress'
  | 'sparkline'
  | 'avatar'
  | 'actions'
  | 'checkbox'
  | 'image'
  | 'link'
  | 'tags';

@Entity('view_columns')
@Index(['viewId'])
@Index(['propertyId'])
@Index(['viewId', 'sortOrder'])
@Index(['viewId', 'propertyCode'], { unique: true })
export class ViewColumn {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Parent view */
  @Column({ name: 'view_id', type: 'uuid' })
  viewId!: string;

  @ManyToOne(() => ViewDefinition, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'view_id' })
  view?: ViewDefinition;

  /** Referenced property */
  @Column({ name: 'property_id', type: 'uuid', nullable: true })
  propertyId?: string | null;

  @ManyToOne(() => PropertyDefinition, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'property_id' })
  property?: PropertyDefinition | null;

  /** Property code (for virtual/computed columns) */
  @Column({ name: 'property_code', type: 'varchar', length: 100, nullable: true })
  propertyCode?: string | null;

  /** Custom label override */
  @Column({ type: 'varchar', length: 200, nullable: true })
  label?: string | null;

  /** Column width in pixels */
  @Column({ type: 'int', nullable: true })
  width?: number | null;

  /** Minimum column width */
  @Column({ name: 'min_width', type: 'int', nullable: true })
  minWidth?: number | null;

  /** Maximum column width */
  @Column({ name: 'max_width', type: 'int', nullable: true })
  maxWidth?: number | null;

  /** Is column visible */
  @Column({ name: 'is_visible', type: 'boolean', default: true })
  isVisible!: boolean;

  /** Can sort by this column */
  @Column({ name: 'is_sortable', type: 'boolean', default: true })
  isSortable!: boolean;

  /** Can filter by this column */
  @Column({ name: 'is_filterable', type: 'boolean', default: true })
  isFilterable!: boolean;

  /** Can resize this column */
  @Column({ name: 'is_resizable', type: 'boolean', default: true })
  isResizable!: boolean;

  /** Is column frozen (always visible when scrolling) */
  @Column({ name: 'is_frozen', type: 'boolean', default: false })
  isFrozen!: boolean;

  /** Pin to left side */
  @Column({ name: 'is_pinned_left', type: 'boolean', default: false })
  isPinnedLeft!: boolean;

  /** Pin to right side */
  @Column({ name: 'is_pinned_right', type: 'boolean', default: false })
  isPinnedRight!: boolean;

  /** Display order */
  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  /** Text alignment */
  @Column({ type: 'varchar', length: 10, default: 'left' })
  alignment!: ColumnAlignment;

  /** Value formatter */
  @Column({ type: 'varchar', length: 50, nullable: true })
  formatter?: CellFormatter | null;

  /** Formatter options */
  @Column({ name: 'formatter_options', type: 'jsonb', default: () => `'{}'` })
  formatterOptions!: Record<string, unknown>;

  /** Cell renderer component */
  @Column({ name: 'cell_renderer', type: 'varchar', length: 50, nullable: true })
  cellRenderer?: CellRenderer | null;

  /** Cell renderer options */
  @Column({ name: 'cell_renderer_options', type: 'jsonb', default: () => `'{}'` })
  cellRendererOptions!: Record<string, unknown>;

  /** Tooltip shown on header hover */
  @Column({ name: 'header_tooltip', type: 'varchar', length: 500, nullable: true })
  headerTooltip?: string | null;

  /** Aggregate function for grouping */
  @Column({ name: 'aggregate_function', type: 'varchar', length: 20, nullable: true })
  aggregateFunction?: AggregateFunction | null;

  /** Wrap text in cell */
  @Column({ name: 'wrap_text', type: 'boolean', default: false })
  wrapText!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
