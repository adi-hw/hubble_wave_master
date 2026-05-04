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
import { CollectionDefinition } from './collection-definition.entity';
import { User } from './user.entity';

export type DisplayRuleStatus = 'draft' | 'published' | 'deprecated';
export type DisplayRuleRevisionStatus = 'draft' | 'published';

/**
 * Action a Display Rule applies to a property when its condition
 * evaluates true. Actions are deliberately structured (not free-text
 * scripts) — same restriction the plan §1 manifesto applies to
 * Automation Actions, applied here for the same reasons (auditable,
 * upgrade-safe, AI-callable).
 */
export type DisplayActionKind =
  | 'show'
  | 'hide'
  | 'mandatory'
  | 'optional'
  | 'readonly'
  | 'editable'
  | 'setValue';

export interface DisplayAction {
  /** Code of the property this action applies to. */
  propertyCode: string;
  action: DisplayActionKind;
  /** Used by `setValue`; ignored by other actions. */
  value?: unknown;
}

/**
 * Plan §7.3 Display Rule — declarative form-time policy that flips
 * fields between visible/hidden, mandatory/optional, readonly/editable,
 * or back-fills a value when a condition holds. Conditions reuse the
 * same shape as svc-automation `Condition` (and/or/single property
 * with operator) so the same evaluator can run server-side at form
 * load and client-side on field change.
 */
@Entity('display_rules')
@Index(['collectionId', 'isActive'])
@Index(['applicationId'])
@Index(['status'])
export class DisplayRule {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ name: 'collection_id', type: 'uuid' })
  collectionId!: string;

  @ManyToOne(() => CollectionDefinition, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'collection_id' })
  collection?: CollectionDefinition;

  @Column({ name: 'application_id', type: 'uuid' })
  applicationId!: string;

  /** Condition tree (and/or/single). Empty object treated as always-true. */
  @Column({ type: 'jsonb', default: () => `'{}'::jsonb` })
  condition!: Record<string, unknown>;

  /** Ordered list of structured DisplayActions. */
  @Column({ type: 'jsonb', default: () => `'[]'::jsonb` })
  actions!: DisplayAction[];

  /**
   * Lower priority runs first. Actions are applied last-write-wins per
   * (propertyCode, action-kind) so a higher-priority rule overrides a
   * lower one. Default 100.
   */
  @Column({ type: 'integer', default: 100 })
  priority!: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'varchar', length: 20, default: 'draft' })
  status!: DisplayRuleStatus;

  @Column({ name: 'current_revision_id', type: 'uuid', nullable: true })
  currentRevisionId?: string | null;

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
}

/**
 * Append-only edit history for DisplayRule. Mirrors the ADR-5
 * pattern used by CollectionDefinitionRevision /
 * PropertyDefinitionRevision so authoring lifecycle is uniform.
 */
@Entity('display_rule_revisions')
@Index(['displayRuleId'])
@Index(['status'])
@Index(['displayRuleId', 'revision'], { unique: true })
export class DisplayRuleRevision {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'display_rule_id', type: 'uuid' })
  displayRuleId!: string;

  @ManyToOne(() => DisplayRule, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'display_rule_id' })
  displayRule?: DisplayRule;

  @Column({ type: 'integer' })
  revision!: number;

  @Column({ type: 'varchar', length: 20 })
  status!: DisplayRuleRevisionStatus;

  @Column({ type: 'jsonb', default: () => `'{}'::jsonb` })
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
