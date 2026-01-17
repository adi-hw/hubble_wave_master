/**
 * Automation Types for svc-data
 */

export type TriggerTiming = 'before' | 'after' | 'async';

export interface ExecutionContext {
  user: {
    id: string;
    email?: string;
    roles?: string[];
  };
  record: Record<string, unknown>;
  previousRecord?: Record<string, unknown>;
  changes: string[];
  automation: {
    id: string;
    name: string;
    triggerTiming: TriggerTiming;
    abortOnError: boolean;
  };
  depth: number;
  maxDepth: number;
  executionChain: string[];
  recordsModified: Map<string, Record<string, unknown>>;
  outputs: Record<string, unknown>;
  asyncQueue: QueuedAction[];
  errors: Array<{ property: string; message: string }>;
  warnings: Array<{ property: string; message: string }>;
}

export interface ExecutionResult {
  success: boolean;
  automationId: string;
  status: 'success' | 'error' | 'skipped';
  skippedReason?: string;
  modifiedRecord?: Record<string, unknown>;
  asyncQueue: QueuedAction[];
  errors: Array<{ property: string; message: string }>;
  warnings: Array<{ property: string; message: string }>;
  actionsExecuted: ActionExecutionResult[];
  durationMs: number;
}

export interface ActionExecutionResult {
  actionId: string;
  actionType: string;
  success: boolean;
  error?: string;
  output?: unknown;
  durationMs: number;
}

export interface QueuedAction {
  action: AutomationAction;
  executeAsync: boolean;
  executeAfterCommit: boolean;
}

export interface AutomationAction {
  id: string;
  type: string;
  config: Record<string, unknown>;
  condition?: Condition;
  continueOnError?: boolean;
}

// ============================================================================
// CANONICAL CONDITION FORMAT
// ============================================================================
//
// HubbleWave uses ONE condition format everywhere:
// - Automation rules
// - View filters
// - Access rule conditions
// - Process flow transitions
//
// Format:
// - Logical groups: { and: [...] } or { or: [...] }
// - Single condition: { property, operator, value }
// - Nestable to any depth
//
// Examples:
//   Simple:     { property: "status", operator: "equals", value: "active" }
//   AND group:  { and: [{ property: "status", operator: "equals", value: "active" },
//                       { property: "priority", operator: "greater_than", value: 3 }] }
//   Nested:     { or: [{ property: "urgent", operator: "equals", value: true },
//                      { and: [{ property: "priority", operator: "equals", value: 1 },
//                              { property: "sla_breach", operator: "equals", value: true }] }] }
// ============================================================================

/**
 * A condition can be either a logical group (and/or) or a single property comparison
 */
export type Condition = ConditionGroup | SingleCondition;

/**
 * Logical grouping of conditions
 */
export interface ConditionGroup {
  and?: Condition[];
  or?: Condition[];
}

/**
 * Single property comparison
 */
export interface SingleCondition {
  property: string;
  operator: ConditionOperator;
  value: unknown;
}

export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'greater_than'
  | 'greater_than_or_equals'
  | 'greater_equal'
  | 'less_than'
  | 'less_than_or_equals'
  | 'less_equal'
  | 'in'
  | 'not_in'
  | 'is_null'
  | 'is_not_null'
  | 'is_today'
  | 'is_past'
  | 'is_future'
  | 'between'
  | 'changed'
  | 'changed_to'
  | 'changed_from';

export interface Assumption {
  field: string;
  expectedValue: unknown;
  reason: string;
}

// Action Config Types
export interface SetValueConfig {
  property: string;
  value: unknown;
  expression?: string;
  onlyIfEmpty?: boolean;
}

export interface SetValuesConfig {
  values: Record<string, unknown>;
}

export interface CreateRecordConfig {
  collection: string;
  data?: Record<string, unknown>;
  values?: Record<string, unknown>;
  copyFromSource?: string[];
}

export interface UpdateRecordConfig {
  recordId: string;
  collection: string;
  data: Record<string, unknown>;
}

export interface DeleteRecordConfig {
  recordId: string;
  collection: string;
}

export interface CallScriptConfig {
  scriptId: string;
  parameters: Record<string, unknown>;
}

export interface SendNotificationConfig {
  templateId?: string;
  template?: string;
  recipients: string[];
  data?: Record<string, unknown>;
}

export interface LogEventConfig {
  eventType?: string;
  event?: string;
  message?: string;
  severity?: 'info' | 'warning' | 'error';
  data?: Record<string, unknown>;
}

export interface AddCommentConfig {
  content: string;
  author?: string;
  type?: string;
}

export interface AbortConfig {
  message: string;
  reason?: string;
  code?: string;
}

export interface AddErrorConfig {
  property: string;
  message: string;
}

export interface AddWarningConfig {
  property: string;
  message: string;
}
