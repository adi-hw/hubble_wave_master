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
import { ViewDefinition, SortConfig, FilterCondition } from './view-definition.entity';

@Entity('user_view_preferences')
@Index(['userId'])
@Index(['viewId'])
@Index(['userId', 'viewId'], { unique: true })
export class UserViewPreference {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** User who owns these preferences */
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  /** View these preferences apply to */
  @Column({ name: 'view_id', type: 'uuid' })
  viewId!: string;

  @ManyToOne(() => ViewDefinition, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'view_id' })
  view?: ViewDefinition;

  /** Custom column order (array of property codes) */
  @Column({ name: 'column_order', type: 'jsonb', default: () => `'[]'` })
  columnOrder!: string[];

  /** Custom column widths (propertyCode -> width) */
  @Column({ name: 'column_widths', type: 'jsonb', default: () => `'{}'` })
  columnWidths!: Record<string, number>;

  /** Hidden columns (array of property codes) */
  @Column({ name: 'hidden_columns', type: 'jsonb', default: () => `'[]'` })
  hiddenColumns!: string[];

  /** Current active filters */
  @Column({ type: 'jsonb', default: () => `'[]'` })
  filters!: FilterCondition[];

  /** Current sort configuration */
  @Column({ name: 'sort_config', type: 'jsonb', default: () => `'[]'` })
  sortConfig!: SortConfig[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
