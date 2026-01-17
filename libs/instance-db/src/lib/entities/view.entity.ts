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
import { User } from './user.entity';

export type ViewScope = 'system' | 'instance' | 'role' | 'group' | 'personal';
export type ViewKind = 'form' | 'list' | 'page';
export type ViewRevisionStatus = 'draft' | 'published';

@Entity('view_definitions')
@Index(['code'], { unique: true })
@Index(['kind'])
@Index(['targetCollectionCode'])
export class ViewDefinition {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'code', type: 'varchar', length: 120 })
  code!: string;

  @Column({ name: 'name', type: 'varchar', length: 255 })
  name!: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description?: string | null;

  @Column({ name: 'kind', type: 'varchar', length: 20 })
  kind!: ViewKind;

  @Column({ name: 'target_collection_code', type: 'varchar', length: 120, nullable: true })
  targetCollectionCode?: string | null;

  @Column({ name: 'metadata', type: 'jsonb', default: () => `'{}'` })
  metadata!: Record<string, unknown>;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdByUser?: User | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'updated_by' })
  updatedByUser?: User | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

@Entity('view_definition_revisions')
@Index(['definitionId'])
@Index(['status'])
@Index(['definitionId', 'revision'], { unique: true })
export class ViewDefinitionRevision {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'view_definition_id', type: 'uuid' })
  definitionId!: string;

  @ManyToOne(() => ViewDefinition, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'view_definition_id' })
  definition?: ViewDefinition;

  @Column({ name: 'revision', type: 'integer' })
  revision!: number;

  @Column({ name: 'status', type: 'varchar', length: 20 })
  status!: ViewRevisionStatus;

  @Column({ name: 'layout', type: 'jsonb', default: () => `'{}'` })
  layout!: Record<string, unknown>;

  @Column({ name: 'widget_bindings', type: 'jsonb', default: () => `'{}'` })
  widgetBindings!: Record<string, unknown>;

  @Column({ name: 'actions', type: 'jsonb', default: () => `'{}'` })
  actions!: Record<string, unknown>;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdByUser?: User | null;

  @Column({ name: 'published_by', type: 'uuid', nullable: true })
  publishedBy?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'published_by' })
  publishedByUser?: User | null;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

@Entity('view_variants')
@Index(['definitionId'])
@Index(['scope'])
@Index(['scopeKey'])
export class ViewVariant {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'view_definition_id', type: 'uuid' })
  definitionId!: string;

  @ManyToOne(() => ViewDefinition, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'view_definition_id' })
  definition?: ViewDefinition;

  @Column({ name: 'scope', type: 'varchar', length: 20 })
  scope!: ViewScope;

  @Column({ name: 'scope_key', type: 'varchar', length: 120, nullable: true })
  scopeKey?: string | null;

  @Column({ name: 'priority', type: 'integer', default: 100 })
  priority!: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdByUser?: User | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'updated_by' })
  updatedByUser?: User | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

@Entity('widget_catalog')
@Index(['code'], { unique: true })
export class WidgetCatalog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'code', type: 'varchar', length: 120 })
  code!: string;

  @Column({ name: 'name', type: 'varchar', length: 255 })
  name!: string;

  @Column({ name: 'kind', type: 'varchar', length: 50 })
  kind!: string;

  @Column({ name: 'contract', type: 'jsonb', default: () => `'{}'` })
  contract!: Record<string, unknown>;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
