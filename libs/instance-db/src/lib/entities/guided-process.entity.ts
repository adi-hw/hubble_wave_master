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
import { CollectionDefinition } from './collection-definition.entity';
import { User } from './user.entity';

export type GuidedProcessStatus = 'draft' | 'published' | 'deprecated';

/**
 * Activity kind:
 * - `flow`: backed by a Process Flow that executes when the activity
 *   is started.
 * - `manual_task`: a checklist item the user marks complete.
 * - `decision`: a Decision Table evaluated to choose the next branch
 *   (used by branching playbooks).
 */
export type GuidedActivityKind = 'flow' | 'manual_task' | 'decision';

/**
 * Plan §8.3 — Guided Processes (Playbooks). A definition describes
 * a multi-stage workflow runtime users follow on a record. Stages
 * organize activities; activities execute the work (a flow, a
 * manual task, or a decision branch).
 *
 * The runtime experience lives inside the Workspace record page
 * (Phase 5); this slice ships only the metadata model, service,
 * and CRUD endpoints so the runtime is a frontend-only follow-up.
 */
@Entity({ name: 'guided_processes', schema: 'automation' })
@Index(['code'], { unique: true })
@Index(['collectionId'])
@Index(['applicationId'])
@Index(['status'])
export class GuidedProcessDefinition {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 120 })
  code!: string;

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

  @Column({ type: 'varchar', length: 20, default: 'draft' })
  status!: GuidedProcessStatus;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

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

  /** ADR-7 provenance. See CollectionDefinition.source. */
  @Column({ name: 'source', type: 'varchar', length: 120, default: 'custom' })
  source!: string;

  @OneToMany(() => GuidedProcessStage, (stage) => stage.process, { cascade: true })
  stages?: GuidedProcessStage[];
}

export type GuidedProcessRevisionStatus = 'draft' | 'published';

/**
 * Append-only edit history for GuidedProcessDefinition. Mirrors the
 * ADR-5 pattern used by CollectionDefinitionRevision so authoring
 * lifecycle is uniform across metadata entities.
 */
@Entity({ name: 'guided_process_revisions', schema: 'automation' })
@Index(['processId'])
@Index(['status'])
@Index(['processId', 'revision'], { unique: true })
export class GuidedProcessRevision {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'process_id', type: 'uuid' })
  processId!: string;

  @ManyToOne(() => GuidedProcessDefinition, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'process_id' })
  process?: GuidedProcessDefinition;

  @Column({ type: 'integer' })
  revision!: number;

  @Column({ type: 'varchar', length: 20 })
  status!: GuidedProcessRevisionStatus;

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

@Entity({ name: 'guided_process_stages', schema: 'automation' })
@Index(['processId', 'position'], { unique: true })
export class GuidedProcessStage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'process_id', type: 'uuid' })
  processId!: string;

  @ManyToOne(() => GuidedProcessDefinition, (def) => def.stages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'process_id' })
  process?: GuidedProcessDefinition;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'integer' })
  position!: number;

  /**
   * Optional condition evaluated against the record state. When
   * false, the stage is skipped at runtime — used to short-circuit
   * branches in the playbook (e.g., "skip vendor review when
   * type=internal").
   */
  @Column({ name: 'visibility_condition', type: 'jsonb', nullable: true })
  visibilityCondition?: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @OneToMany(() => GuidedProcessActivity, (activity) => activity.stage, { cascade: true })
  activities?: GuidedProcessActivity[];
}

@Entity({ name: 'guided_process_activities', schema: 'automation' })
@Index(['stageId', 'position'], { unique: true })
export class GuidedProcessActivity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'stage_id', type: 'uuid' })
  stageId!: string;

  @ManyToOne(() => GuidedProcessStage, (stage) => stage.activities, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'stage_id' })
  stage?: GuidedProcessStage;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'integer' })
  position!: number;

  @Column({ type: 'varchar', length: 20 })
  kind!: GuidedActivityKind;

  /**
   * For kind='flow': the Process Flow code to invoke.
   * For kind='decision': the Decision Table code to evaluate.
   * Ignored for kind='manual_task'.
   */
  @Column({ name: 'process_flow_code', type: 'varchar', length: 120, nullable: true })
  processFlowCode?: string | null;

  /**
   * Optional condition that must hold before the activity is
   * considered required. When false, the activity is optional /
   * informational.
   */
  @Column({ name: 'required_condition', type: 'jsonb', nullable: true })
  requiredCondition?: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
