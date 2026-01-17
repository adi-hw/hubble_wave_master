export type AlertConditionConfig = {
  metric_code?: string;
  metricCode?: string;
  operator?: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq';
  threshold?: number;
  cooldown_minutes?: number;
  cooldownMinutes?: number;
};

export type AlertNotificationAction = {
  template_code?: string;
  templateCode?: string;
  template_id?: string;
  templateId?: string;
  recipients?: string[];
  channels?: string[];
  data?: Record<string, unknown>;
};

export type AlertWorkflowAction = {
  workflow_id?: string;
  workflowId?: string;
  workflow_code?: string;
  workflowCode?: string;
  inputs?: Record<string, unknown>;
  run_as?: string;
  runAs?: string;
};

export type AlertActionConfig = {
  notify?: AlertNotificationAction;
  workflow?: AlertWorkflowAction;
};
