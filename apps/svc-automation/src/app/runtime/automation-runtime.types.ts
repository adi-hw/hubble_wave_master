export type TriggerTiming = 'before' | 'after' | 'async';
export type TriggerOperation = 'insert' | 'update' | 'delete' | 'query';

export interface AutomationUserContext {
  id: string | null;
  email?: string;
  roles?: string[];
}

export interface ExecutionContext {
  user: AutomationUserContext;
  record: Record<string, unknown>;
  previousRecord?: Record<string, unknown> | null;
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
  outputs: Record<string, unknown>;
  errors: Array<{ property: string; message: string }>;
  warnings: Array<{ property: string; message: string }>;
}

export interface ActionExecutionResult {
  actionId: string;
  actionType: string;
  success: boolean;
  error?: string;
  output?: unknown;
  durationMs: number;
}

export interface ActionResult {
  type:
    | 'modify_record'
    | 'create_record'
    | 'send_notification'
    | 'start_workflow'
    | 'abort'
    | 'add_error'
    | 'add_warning'
    | 'none';
  changes?: Record<string, unknown>;
  message?: string;
  property?: string;
  output?: unknown;
}

export interface AutomationAction {
  id: string;
  type: string;
  config: Record<string, unknown>;
  condition?: Condition;
  continueOnError?: boolean;
}

export type Condition = ConditionGroup | SingleCondition;

export interface ConditionGroup {
  and?: Condition[];
  or?: Condition[];
}

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

export interface SendNotificationConfig {
  templateId?: string;
  template?: string;
  templateCode?: string;
  recipients: string[];
  data?: Record<string, unknown>;
}

export interface StartWorkflowConfig {
  workflowId: string;
  inputs?: Record<string, unknown>;
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

export interface RecordEventPayload {
  eventType: string;
  collectionCode: string;
  recordId: string;
  record?: Record<string, unknown>;
  previousRecord?: Record<string, unknown> | null;
  changedProperties?: string[];
  userId?: string | null;
  metadata?: Record<string, unknown>;
  occurredAt: string;
}
