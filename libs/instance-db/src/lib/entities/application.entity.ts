import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

/**
 * Application — the unit of metadata grouping inside a customer instance.
 *
 * Per HubbleWave canon §5 a single instance is one customer; an
 * Application is the customer's sub-grouping inside that instance (HR, IT,
 * Facilities can each be an Application). Every metadata entity that
 * needs scoping (Collections, Views, Forms, Workflows, Automations,
 * Workspaces, Decision Tables, Widgets, Navigation Modules) carries an
 * `application_id` foreign key referencing this entity.
 *
 * The Application is also the pilot surface for ADR-5 (uniform DRAFT /
 * PUBLISHED revisions). Subsequent metadata entities adopt the same
 * pattern after this one is proven.
 */

export type ApplicationStatus = 'draft' | 'published' | 'deprecated';
export type ApplicationRevisionStatus = 'draft' | 'published';

@Entity('applications')
@Index(['code'], { unique: true })
@Index(['status'])
export class Application {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * Stable machine identifier used in API paths, code references, and
   * cross-application name resolution. Lower-snake-case.
   */
  @Column({ name: 'code', type: 'varchar', length: 120 })
  code!: string;

  /** Human-readable name shown in App Studio. */
  @Column({ name: 'name', type: 'varchar', length: 255 })
  name!: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description?: string | null;

  /** Optional URL-safe scope segment used in naming-shortcut routes. */
  @Column({ name: 'scope', type: 'varchar', length: 120, nullable: true })
  scope?: string | null;

  /**
   * Provenance per ADR-7. `pack:<pack-id>` for pack-shipped apps;
   * `custom` for customer-created. Defaults to `custom` because Slice A
   * doesn't yet involve packs; ADR-7 gets full enforcement in Phase 6.
   */
  @Column({ name: 'source', type: 'varchar', length: 120, default: 'custom' })
  source!: string;

  /**
   * Top-level lifecycle for the Application itself. The current draft is
   * the row pointed to by `currentRevisionId`. Subsequent metadata
   * entities that reference this Application should not require its
   * `published` status — sub-artifacts run their own lifecycles.
   */
  @Column({ name: 'status', type: 'varchar', length: 20, default: 'draft' })
  status!: ApplicationStatus;

  /** The revision the Application currently advertises as canonical. */
  @Column({ name: 'current_revision_id', type: 'uuid', nullable: true })
  currentRevisionId?: string | null;

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

/**
 * ApplicationRevision — append-only edit history for an Application.
 * Mirrors `ViewDefinitionRevision` so the lifecycle pattern is
 * consistent with the existing platform surface, ahead of the
 * broader ADR-5 rollout in Slice C.
 */
@Entity('application_revisions')
@Index(['applicationId'])
@Index(['status'])
@Index(['applicationId', 'revision'], { unique: true })
export class ApplicationRevision {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'application_id', type: 'uuid' })
  applicationId!: string;

  @ManyToOne(() => Application, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'application_id' })
  application?: Application;

  @Column({ name: 'revision', type: 'integer' })
  revision!: number;

  @Column({ name: 'status', type: 'varchar', length: 20 })
  status!: ApplicationRevisionStatus;

  /**
   * Snapshot of the Application's authoring fields at this revision.
   * Stored as JSON so future fields don't require schema migrations
   * just to be revisioned.
   */
  @Column({ name: 'payload', type: 'jsonb', default: () => `'{}'` })
  payload!: Record<string, unknown>;

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
