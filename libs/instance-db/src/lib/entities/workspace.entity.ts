import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Application } from './application.entity';
import { CollectionDefinition } from './collection-definition.entity';
import { User } from './user.entity';

export type WorkspaceStatus = 'draft' | 'published' | 'deprecated';

/**
 * Plan §10 / ADR-15 — a Workspace is a multi-page experience built
 * on top of an Application. Each Workspace seeds five default pages
 * (home / list / record / search / analytics) bound to a chosen
 * Collection; admins compose them in the Workspace Builder, runtime
 * users navigate them in the WorkspaceRenderer.
 *
 * Lifecycle (ADR-5) follows the same pattern as ProcessFlowDefinition
 * / DecisionTable / GuidedProcess: draft / published / deprecated
 * with publishedAt + isActive operational gate.
 */
@Entity({ name: 'workspace_definitions', schema: 'metadata' })
@Index(['code'], { unique: true })
@Index(['applicationId'])
@Index(['status'])
export class WorkspaceDefinition {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 120 })
  code!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ name: 'application_id', type: 'uuid' })
  applicationId!: string;

  @ManyToOne(() => Application, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'application_id' })
  application?: Application;

  /**
   * Default Collection bound to this Workspace. Used by the seed step
   * when the workspace is created (list / record / search pages target
   * this collection by default; admins can switch a page to a different
   * collection later).
   */
  @Column({ name: 'default_collection_id', type: 'uuid', nullable: true })
  defaultCollectionId?: string | null;

  @ManyToOne(() => CollectionDefinition, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'default_collection_id' })
  defaultCollection?: CollectionDefinition | null;

  /**
   * Optional theme code — Wave 2 introduced a Theme catalog. The
   * runtime renderer applies this theme over the platform default
   * during workspace bootstrap.
   */
  @Column({ name: 'theme_code', type: 'varchar', length: 120, nullable: true })
  themeCode?: string | null;

  /**
   * ADR-7 provenance. `pack:<id>` rows are protected on pack upgrade;
   * `custom` rows survive untouched. The Studio shell renders a
   * provenance badge per artifact.
   */
  @Column({ type: 'varchar', length: 64, default: 'custom' })
  source!: string;

  @Column({ type: 'varchar', length: 20, default: 'draft' })
  status!: WorkspaceStatus;

  @Column({ name: 'is_active', type: 'boolean', default: false })
  isActive!: boolean;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt?: Date | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdByUser?: User | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => WorkspacePage, (page) => page.workspace, { cascade: true })
  pages?: WorkspacePage[];
}

export type WorkspacePageKind = 'home' | 'list' | 'record' | 'search' | 'analytics' | 'custom';

/**
 * A single panel placed on a workspace page. Geometry is
 * react-grid-layout-shaped (x/y/w/h) so the canvas can drive a stable
 * grid without a custom layout engine.
 */
export interface PanelLayout {
  /** Stable id used for binding + position addressing on the canvas. */
  id: string;
  /** Catalog code from BUILT_IN_PANELS. */
  panelCode: string;
  /** Author-supplied panel config (validated by libs/widget-validator). */
  config: Record<string, unknown>;
  /** react-grid-layout coordinates. */
  x: number;
  y: number;
  w: number;
  h: number;
}

@Entity({ name: 'workspace_pages', schema: 'metadata' })
@Index(['workspaceId', 'code'], { unique: true })
@Index(['workspaceId', 'position'])
export class WorkspacePage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId!: string;

  @ManyToOne(() => WorkspaceDefinition, (ws) => ws.pages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace?: WorkspaceDefinition;

  @Column({ type: 'varchar', length: 120 })
  code!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 20 })
  kind!: WorkspacePageKind;

  @Column({ type: 'integer', default: 0 })
  position!: number;

  @Column({ type: 'jsonb', default: () => `'[]'::jsonb` })
  layout!: PanelLayout[];

  /**
   * Source attribution per ADR-7. Page kind drives the direct-edit
   * policy:
   * - `home` is always editable
   * - `list` / `record` / `search` / `analytics` from `pack:*` require
   *   a WorkspaceVariant override before mutation; the service
   *   enforces that gate at write-time.
   */
  @Column({ type: 'varchar', length: 64, default: 'custom' })
  source!: string;

  /**
   * Optional collection this page targets (record / list / search).
   * Null for home / analytics / custom unless the author binds one.
   */
  @Column({ name: 'collection_id', type: 'uuid', nullable: true })
  collectionId?: string | null;

  @ManyToOne(() => CollectionDefinition, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'collection_id' })
  collection?: CollectionDefinition | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

/**
 * Plan §7 hierarchy. A WorkspaceVariant overrides a page's layout for
 * a specific scope (system → instance → role → group → personal). The
 * runtime renderer resolves a single effective layout per page per user
 * by walking the priority order and picking the highest-priority match.
 */
export type WorkspaceVariantScope = 'system' | 'instance' | 'role' | 'group' | 'personal';

@Entity({ name: 'workspace_variants', schema: 'metadata' })
@Index(['workspaceId', 'pageId'])
@Index(['scope', 'scopeRef'])
export class WorkspaceVariant {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId!: string;

  @Column({ name: 'page_id', type: 'uuid' })
  pageId!: string;

  @Column({ type: 'varchar', length: 16 })
  scope!: WorkspaceVariantScope;

  /**
   * For `role` / `group` / `personal` scopes: the role code, group id,
   * or user id this variant applies to. For `system` / `instance`:
   * null (only one variant per scope makes sense).
   */
  @Column({ name: 'scope_ref', type: 'varchar', length: 255, nullable: true })
  scopeRef?: string | null;

  /**
   * Priority within the scope hierarchy. Lower number wins ties (so
   * authors can intentionally promote a variant). The renderer's
   * resolution order is `personal > group > role > instance > system`
   * regardless of priority — priority breaks ties WITHIN a scope.
   */
  @Column({ type: 'integer', default: 100 })
  priority!: number;

  @Column({ type: 'jsonb', default: () => `'[]'::jsonb` })
  layout!: PanelLayout[];

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
