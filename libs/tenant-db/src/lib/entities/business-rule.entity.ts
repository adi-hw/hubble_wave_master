import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { ConditionExpression } from './shared-types';

export type RuleTrigger = 'before_insert' | 'after_insert' | 'before_update' | 'after_update' | 'before_delete' | 'after_delete' | 'async';
export type RuleConditionType = 'always' | 'field_changed' | 'condition_met' | 'script';
export type RuleActionType = 'set_value' | 'validate' | 'abort' | 'script' | 'workflow' | 'notification' | 'api_call';
export type RuleSource = 'platform' | 'module' | 'tenant';

// Re-export for convenience
export { ConditionExpression };

/**
 * Defines business rules that execute in response to record events.
 * Supports both declarative conditions and script-based logic.
 */
@Entity('business_rule')
@Index(['tenantId', 'code'], { unique: true })
@Index(['targetTable', 'trigger', 'isActive'])
@Index(['executionOrder'])
export class BusinessRule {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId?: string; // NULL for platform rules

  @Column({ type: 'varchar', length: 100 })
  code!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'target_table', type: 'varchar', length: 100 })
  targetTable!: string; // Table this rule applies to

  @Column({ type: 'varchar', length: 30 })
  trigger!: RuleTrigger;

  @Column({ name: 'execution_order', type: 'int', default: 100 })
  executionOrder!: number; // Lower numbers execute first

  // Condition configuration
  @Column({ name: 'condition_type', type: 'varchar', length: 30, default: 'always' })
  conditionType!: RuleConditionType;

  /**
   * Fields that must change to trigger the rule (for 'field_changed' condition).
   */
  @Column({ name: 'watch_fields', type: 'jsonb', nullable: true })
  watchFields?: string[];

  /**
   * Declarative condition in JSON Query format.
   */
  @Column({ name: 'condition_expression', type: 'jsonb', nullable: true })
  conditionExpression?: ConditionExpression;

  /**
   * Script to evaluate condition (for 'script' condition type).
   */
  @Column({ name: 'condition_script', type: 'text', nullable: true })
  conditionScript?: string;

  // Action configuration
  @Column({ name: 'action_type', type: 'varchar', length: 30 })
  actionType!: RuleActionType;

  /**
   * Configuration for the action.
   */
  @Column({ name: 'action_config', type: 'jsonb' })
  actionConfig!: ActionConfig;

  /**
   * Script to execute (for 'script' action type).
   */
  @Column({ name: 'action_script', type: 'text', nullable: true })
  actionScript?: string;

  /**
   * Script context and allowed APIs.
   */
  @Column({ name: 'script_context', type: 'jsonb', nullable: true })
  scriptContext?: ScriptContext;

  // Error handling
  @Column({ name: 'on_error', type: 'varchar', length: 30, default: 'abort' })
  onError!: 'abort' | 'log_continue' | 'notify_admin';

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string;

  // Metadata
  @Column({ type: 'varchar', length: 20, default: 'tenant' })
  source!: RuleSource;

  @Column({ name: 'platform_version', type: 'varchar', length: 20, nullable: true })
  platformVersion?: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'is_system', type: 'boolean', default: false })
  isSystem!: boolean; // System rules cannot be modified by tenant

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}

// Supporting interfaces
export interface ActionConfig {
  // For 'set_value' action
  fieldMappings?: FieldMapping[];

  // For 'validate' action
  validationRules?: ValidationRule[];

  // For 'workflow' action
  workflowCode?: string;
  workflowInputMapping?: Record<string, string>;

  // For 'notification' action
  templateCode?: string;
  recipients?: string[] | string; // Static list or field reference

  // For 'api_call' action
  endpoint?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  bodyMapping?: Record<string, string>;
}

export interface FieldMapping {
  targetField: string;
  sourceType: 'value' | 'field' | 'expression' | 'script';
  sourceValue: any;
}

export interface ValidationRule {
  field: string;
  rule: string; // 'required', 'email', 'regex', 'min', 'max', 'custom'
  params?: any;
  message: string;
}

export interface ScriptContext {
  allowedModules?: string[];
  timeoutMs?: number;
  memoryLimitMb?: number;
  allowHttpCalls?: boolean;
  allowDbQueries?: boolean;
}
