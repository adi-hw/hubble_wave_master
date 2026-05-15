/**
 * Automation Entities
 * HubbleWave Platform - Phase 3
 *
 * Business Rules, Triggers, Scheduled Jobs, and related automation storage.
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { User } from './user.entity';

// ─────────────────────────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────────────────────────

export type TriggerTiming = 'before' | 'after' | 'async';
export type TriggerOperation = 'insert' | 'update' | 'delete' | 'query';
export type AutomationConditionType = 'always' | 'condition' | 'script';
export type AutomationActionType = 'no_code' | 'script';
export type ExecutionStatus = 'success' | 'error' | 'skipped' | 'timeout';
export type ScheduleFrequency = 'once' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'cron';

/**
 * Lifecycle status for the automation rule itself (ADR-5).
 *  - draft: editable; runtime triggers do NOT fire
 *  - published: authoritative; triggers fire when isActive = true
 *  - deprecated: no new firings; existing runs finish on their own
 *
 * `isActive` (operational on/off switch) is orthogonal and persists.
 */
export type AutomationRuleStatus = 'draft' | 'published' | 'deprecated';
export type AutomationRuleRevisionStatus = 'draft' | 'published';

// ─────────────────────────────────────────────────────────────────
// Automation Rule Entity
// ─────────────────────────────────────────────────────────────────

@Entity({ name: 'automation_rules', schema: 'automation' })
@Index(['collectionId', 'isActive'])
@Index(['triggerTiming', 'isActive'])
@Index(['applicationId'])
@Index(['status'])
export class AutomationRule {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 128 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'collection_id', type: 'uuid' })
  @Index()
  collectionId!: string;

  /**
   * Application this rule belongs to (ADR-6). Backfilled from the
   * parent collection during slice C3.
   */
  @Column({ name: 'application_id', type: 'uuid', nullable: true })
  applicationId?: string | null;

  @Column({ name: 'trigger_timing', type: 'varchar', length: 16 })
  triggerTiming!: TriggerTiming;

  @Column({ name: 'trigger_operations', type: 'jsonb', default: '["insert","update"]' })
  triggerOperations!: TriggerOperation[];

  @Column({ name: 'watch_properties', type: 'jsonb', nullable: true })
  watchProperties?: string[];

  @Column({ name: 'condition_type', type: 'varchar', length: 16, default: 'always' })
  conditionType!: AutomationConditionType;

  @Column({ type: 'jsonb', nullable: true })
  condition?: Record<string, unknown>;

  @Column({ name: 'condition_script', type: 'text', nullable: true })
  conditionScript?: string;

  @Column({ name: 'action_type', type: 'varchar', length: 16, default: 'no_code' })
  actionType!: AutomationActionType;

  @Column({ type: 'jsonb', nullable: true })
  actions?: AutomationAction[];

  @Column({ type: 'text', nullable: true })
  script?: string;

  @Column({ name: 'abort_on_error', type: 'boolean', default: false })
  abortOnError!: boolean;

  @Column({ name: 'execution_order', type: 'int', default: 100 })
  executionOrder!: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'is_system', type: 'boolean', default: false })
  isSystem!: boolean;

  @Column({ name: 'consecutive_errors', type: 'int', default: 0 })
  consecutiveErrors!: number;

  @Column({ name: 'last_executed_at', type: 'timestamptz', nullable: true })
  lastExecutedAt?: Date;

  @Column({ type: 'jsonb', default: '{}' })
  metadata!: Record<string, unknown>;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  // ─────────────────────────────────────────────────────────────────
  // Lifecycle (ADR-5)
  // ─────────────────────────────────────────────────────────────────

  @Column({ type: 'varchar', length: 20, default: 'draft' })
  status!: AutomationRuleStatus;

  @Column({ name: 'current_revision_id', type: 'uuid', nullable: true })
  currentRevisionId?: string | null;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt?: Date | null;

  /** ADR-7 provenance. See CollectionDefinition.source. */
  @Column({ name: 'source', type: 'varchar', length: 120, default: 'custom' })
  source!: string;

  @OneToMany(() => AutomationExecutionLog, (log) => log.automationRule)
  executionLogs!: AutomationExecutionLog[];
}

/**
 * Append-only edit history for an AutomationRule. Mirrors
 * CollectionDefinitionRevision so the lifecycle pattern is uniform
 * across metadata entities (ADR-5).
 */
@Entity({ name: 'automation_rule_revisions', schema: 'automation' })
@Index(['automationRuleId'])
@Index(['status'])
@Index(['automationRuleId', 'revision'], { unique: true })
export class AutomationRuleRevision {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'automation_rule_id', type: 'uuid' })
  automationRuleId!: string;

  @ManyToOne(() => AutomationRule, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'automation_rule_id' })
  automationRule?: AutomationRule;

  @Column({ name: 'revision', type: 'integer' })
  revision!: number;

  @Column({ name: 'status', type: 'varchar', length: 20 })
  status!: AutomationRuleRevisionStatus;

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

// ─────────────────────────────────────────────────────────────────
// Automation Action Interface (stored in JSON)
// ─────────────────────────────────────────────────────────────────

export interface AutomationAction {
  id: string;
  type: string;
  config: Record<string, unknown>;
  condition?: Record<string, unknown>;
  continueOnError?: boolean;
}

// ─────────────────────────────────────────────────────────────────
// Scheduled Job Entity
// ─────────────────────────────────────────────────────────────────

@Entity({ name: 'scheduled_jobs', schema: 'automation' })
@Index(['isActive', 'nextRunAt'])
export class ScheduledJob {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 128 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'collection_id', type: 'uuid', nullable: true })
  collectionId?: string;

  @Column({ type: 'varchar', length: 16, default: 'daily' })
  frequency!: ScheduleFrequency;

  @Column({ name: 'cron_expression', type: 'varchar', length: 64, nullable: true })
  cronExpression?: string;

  @Column({ type: 'varchar', length: 64, default: 'UTC' })
  timezone!: string;

  @Column({ name: 'action_type', type: 'varchar', length: 16, default: 'no_code' })
  actionType!: AutomationActionType;

  @Column({ type: 'jsonb', nullable: true })
  actions?: AutomationAction[];

  @Column({ type: 'text', nullable: true })
  script?: string;

  @Column({ name: 'query_filter', type: 'jsonb', nullable: true })
  queryFilter?: Record<string, unknown>;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'next_run_at', type: 'timestamptz', nullable: true })
  nextRunAt?: Date;

  @Column({ name: 'last_run_at', type: 'timestamptz', nullable: true })
  lastRunAt?: Date;

  @Column({ name: 'last_run_status', type: 'varchar', length: 16, nullable: true })
  lastRunStatus?: ExecutionStatus;

  @Column({ name: 'consecutive_failures', type: 'int', default: 0 })
  consecutiveFailures!: number;

  @Column({ name: 'max_retries', type: 'int', default: 3 })
  maxRetries!: number;

  @Column({ type: 'jsonb', default: '{}' })
  metadata!: Record<string, unknown>;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

// ─────────────────────────────────────────────────────────────────
// Automation Execution Log Entity
// ─────────────────────────────────────────────────────────────────

@Entity({ name: 'automation_execution_logs', schema: 'automation' })
@Index(['automationRuleId', 'createdAt'])
@Index(['recordId', 'createdAt'])
@Index(['status', 'createdAt'])
export class AutomationExecutionLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'automation_rule_id', type: 'uuid', nullable: true })
  automationRuleId?: string;

  @Column({ name: 'scheduled_job_id', type: 'uuid', nullable: true })
  scheduledJobId?: string;

  @Column({ name: 'automation_type', type: 'varchar', length: 16 })
  automationType!: 'data' | 'scheduled';

  @Column({ name: 'automation_name', type: 'varchar', length: 128 })
  automationName!: string;

  @Column({ name: 'collection_id', type: 'uuid', nullable: true })
  collectionId?: string;

  @Column({ name: 'record_id', type: 'uuid', nullable: true })
  recordId?: string;

  @Column({ name: 'trigger_event', type: 'varchar', length: 32, nullable: true })
  triggerEvent?: string;

  @Column({ name: 'trigger_timing', type: 'varchar', length: 16, nullable: true })
  triggerTiming?: string;

  @Column({ type: 'varchar', length: 16 })
  status!: ExecutionStatus;

  @Column({ name: 'skipped_reason', type: 'text', nullable: true })
  skippedReason?: string;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ name: 'error_stack', type: 'text', nullable: true })
  errorStack?: string;

  @Column({ name: 'input_data', type: 'jsonb', nullable: true })
  inputData?: Record<string, unknown>;

  @Column({ name: 'output_data', type: 'jsonb', nullable: true })
  outputData?: Record<string, unknown>;

  @Column({ name: 'actions_executed', type: 'jsonb', nullable: true })
  actionsExecuted?: Record<string, unknown>[];

  @Column({ name: 'triggered_by', type: 'uuid', nullable: true })
  triggeredBy?: string;

  @Column({ name: 'execution_depth', type: 'int', default: 1 })
  executionDepth!: number;

  @Column({ name: 'duration_ms', type: 'int', nullable: true })
  durationMs?: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne(() => AutomationRule, (rule) => rule.executionLogs, { nullable: true })
  @JoinColumn({ name: 'automation_rule_id' })
  automationRule?: AutomationRule;
}

// ─────────────────────────────────────────────────────────────────
// Client Script Entity
// ─────────────────────────────────────────────────────────────────

export type ClientScriptTrigger = 'onLoad' | 'onChange' | 'onSubmit' | 'onCellEdit';

@Entity({ name: 'client_scripts', schema: 'automation' })
@Index(['collectionId', 'isActive'])
export class ClientScript {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 128 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'collection_id', type: 'uuid' })
  @Index()
  collectionId!: string;

  @Column({ name: 'form_id', type: 'uuid', nullable: true })
  formId?: string;

  @Column({ type: 'varchar', length: 16 })
  trigger!: ClientScriptTrigger;

  @Column({ name: 'watch_property', type: 'varchar', length: 64, nullable: true })
  watchProperty?: string;

  @Column({ name: 'condition_type', type: 'varchar', length: 16, default: 'always' })
  conditionType!: AutomationConditionType;

  @Column({ type: 'jsonb', nullable: true })
  condition?: Record<string, unknown>;

  @Column({ type: 'jsonb' })
  actions!: ClientScriptAction[];

  @Column({ name: 'execution_order', type: 'int', default: 100 })
  executionOrder!: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'jsonb', default: '{}' })
  metadata!: Record<string, unknown>;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

// ─────────────────────────────────────────────────────────────────
// Client Script Action Interface (stored in JSON)
// ─────────────────────────────────────────────────────────────────

export interface ClientScriptAction {
  id: string;
  type:
    | 'show_property'
    | 'hide_property'
    | 'make_required'
    | 'make_optional'
    | 'set_value'
    | 'show_message'
    | 'enable_property'
    | 'disable_property'
    | 'validate';
  property?: string;
  value?: unknown;
  message?: string;
  messageType?: 'info' | 'warning' | 'error';
  condition?: Record<string, unknown>;
}
