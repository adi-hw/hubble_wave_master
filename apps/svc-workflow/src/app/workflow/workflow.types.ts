import { ProcessFlowCanvas, ProcessFlowRunAs, TriggerType } from '@hubblewave/instance-db';

export type CreateWorkflowDefinitionRequest = {
  code: string;
  name: string;
  description?: string;
  collectionId?: string;
  triggerType?: TriggerType;
  triggerConditions?: Record<string, unknown>;
  triggerSchedule?: string;
  triggerFilter?: Record<string, unknown>;
  runAs?: ProcessFlowRunAs;
  timeoutMinutes?: number;
  maxRetries?: number;
  canvas?: ProcessFlowCanvas;
};

export type UpdateWorkflowDefinitionRequest = Omit<
  CreateWorkflowDefinitionRequest,
  'code'
>;

export type StartWorkflowRequest = {
  input?: Record<string, unknown>;
  recordId?: string;
};

export type WorkflowListQuery = {
  collectionId?: string;
  active?: boolean;
  code?: string;
};

export type WorkflowInstanceQuery = {
  state?: string;
  processFlowId?: string;
  collectionId?: string;
  recordId?: string;
};
