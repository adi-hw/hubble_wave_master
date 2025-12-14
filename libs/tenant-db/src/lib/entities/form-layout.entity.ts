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

export type LayoutType = 'standard' | 'wizard' | 'tabbed' | 'split' | 'compact';

export interface FormSection {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  collapsed?: boolean;
  collapsible?: boolean;
  columns?: 1 | 2 | 3 | 4;
  conditions?: FilterCondition[];
  fields: FormField[];
}

export interface FormField {
  propertyCode: string;
  label?: string;
  placeholder?: string;
  hint?: string;
  width?: 'quarter' | 'third' | 'half' | 'two_thirds' | 'three_quarters' | 'full';
  readonly?: boolean;
  hidden?: boolean;
  required?: boolean;
  conditions?: FilterCondition[];
  uiComponent?: string;
  uiOptions?: Record<string, unknown>;
}

export interface HeaderConfig {
  titleProperty?: string;
  subtitleProperty?: string;
  avatarProperty?: string;
  badgeProperty?: string;
  showBreadcrumb?: boolean;
  showTabs?: boolean;
  tabs?: { id: string; label: string; icon?: string }[];
}

export interface FooterConfig {
  showTimestamps?: boolean;
  showCreatedBy?: boolean;
  showUpdatedBy?: boolean;
  customFields?: string[];
}

export interface SidebarConfig {
  enabled?: boolean;
  position?: 'left' | 'right';
  width?: number;
  sections?: {
    id: string;
    label: string;
    type: 'activity' | 'related' | 'attachments' | 'custom';
    config?: Record<string, unknown>;
  }[];
}

export interface ActionsConfig {
  showSave?: boolean;
  showCancel?: boolean;
  showDelete?: boolean;
  customActions?: {
    code: string;
    label: string;
    icon?: string;
    variant?: 'primary' | 'secondary' | 'danger';
    position?: 'header' | 'footer';
    conditions?: FilterCondition[];
  }[];
}

export interface RelatedList {
  id: string;
  collectionCode: string;
  label: string;
  relationshipProperty: string;
  viewCode?: string;
  defaultExpanded?: boolean;
  maxRows?: number;
}

@Entity('form_layouts')
@Index(['collectionId'])
@Index(['collectionId', 'code'], { unique: true })
@Index(['collectionId', 'isDefault'])
export class FormLayout {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Parent collection */
  @Column({ name: 'collection_id', type: 'uuid' })
  collectionId!: string;

  @ManyToOne(() => CollectionDefinition, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'collection_id' })
  collection?: CollectionDefinition;

  /** Unique code for this layout */
  @Column({ type: 'varchar', length: 100 })
  code!: string;

  /** Display label */
  @Column({ type: 'varchar', length: 200 })
  label!: string;

  /** Description */
  @Column({ type: 'text', nullable: true })
  description?: string | null;

  /** Type of layout */
  @Column({ name: 'layout_type', type: 'varchar', length: 30, default: 'standard' })
  layoutType!: LayoutType;

  /** Is this the default layout for the collection */
  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault!: boolean;

  /** System layouts cannot be deleted */
  @Column({ name: 'is_system', type: 'boolean', default: false })
  isSystem!: boolean;

  /** Conditions for when this layout applies */
  @Column({ type: 'jsonb', default: () => `'[]'` })
  conditions!: FilterCondition[];

  /** Role IDs that can use this layout */
  @Column({ name: 'role_ids', type: 'jsonb', default: () => `'[]'` })
  roleIds!: string[];

  /** Form sections with fields */
  @Column({ type: 'jsonb', default: () => `'[]'` })
  sections!: FormSection[];

  /** Header configuration */
  @Column({ name: 'header_config', type: 'jsonb', default: () => `'{}'` })
  headerConfig!: HeaderConfig;

  /** Footer configuration */
  @Column({ name: 'footer_config', type: 'jsonb', default: () => `'{}'` })
  footerConfig!: FooterConfig;

  /** Sidebar configuration */
  @Column({ name: 'sidebar_config', type: 'jsonb', default: () => `'{}'` })
  sidebarConfig!: SidebarConfig;

  /** Actions configuration */
  @Column({ name: 'actions_config', type: 'jsonb', default: () => `'{}'` })
  actionsConfig!: ActionsConfig;

  /** Related lists to show */
  @Column({ name: 'related_lists', type: 'jsonb', default: () => `'[]'` })
  relatedLists!: RelatedList[];

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
}
