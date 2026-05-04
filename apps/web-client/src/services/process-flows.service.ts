import { createApiClient } from './api';

const workflowApi = createApiClient('/api/workflows');

export interface ProcessFlowRun {
  id: string;
  status: string;
  input?: any;
  output?: any;
  error?: string;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface ProcessFlowTestRunStep {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  actionType: string | null;
  resolvedConfig: Record<string, unknown>;
  wouldExecute: string;
}

export interface ProcessFlowTestRunResult {
  flowId: string;
  flowCode: string;
  mode: 'dry_run' | 'wet_run';
  steps: ProcessFlowTestRunStep[];
  warning?: string;
}

export type ProcessFlowDefinitionStatus = 'draft' | 'published' | 'deprecated';

export interface ProcessFlowDefinition {
  id: string;
  code: string;
  name: string;
  description?: string;
  triggerType: string;
  triggerConditions?: Record<string, unknown>;
  triggerSchedule?: string;
  triggerFilter?: Record<string, unknown>;
  collectionId?: string | null;
  applicationId?: string | null;
  isActive: boolean;
  status: ProcessFlowDefinitionStatus;
  publishedAt?: string | null;
  executionCount?: number;
  successCount?: number;
  failureCount?: number;
  lastExecutedAt?: string | null;
  canvas: { nodes: any[]; connections: any[] };
}

export interface ListProcessFlowsParams {
  collectionId?: string;
  active?: boolean;
}

export interface SaveProcessFlowDefinitionBody {
  code: string;
  name: string;
  description?: string;
  triggerType?: string;
  triggerConditions?: Record<string, unknown>;
  triggerSchedule?: string;
  triggerFilter?: Record<string, unknown>;
  collectionId?: string;
  canvas?: { nodes: any[]; connections: any[] };
}

export const processFlowsService = {
  list: async (filters: ListProcessFlowsParams = {}): Promise<ProcessFlowDefinition[]> => {
    const params: Record<string, string> = {};
    if (filters.collectionId) params.collectionId = filters.collectionId;
    if (filters.active !== undefined) params.active = filters.active ? 'true' : 'false';
    const res = await workflowApi.get<ProcessFlowDefinition[]>('/definitions', { params });
    return res.data;
  },
  get: async (id: string): Promise<ProcessFlowDefinition> => {
    const res = await workflowApi.get<ProcessFlowDefinition>(`/definitions/${id}`);
    return res.data;
  },
  create: async (body: SaveProcessFlowDefinitionBody) => {
    const res = await workflowApi.post<ProcessFlowDefinition>('/definitions', body);
    return res.data;
  },
  update: async (id: string, body: SaveProcessFlowDefinitionBody) => {
    const res = await workflowApi.put<ProcessFlowDefinition>(`/definitions/${id}`, body);
    return res.data;
  },
  publish: async (id: string): Promise<ProcessFlowDefinition> => {
    const res = await workflowApi.post<ProcessFlowDefinition>(`/definitions/${id}/publish`);
    return res.data;
  },
  activate: async (id: string): Promise<ProcessFlowDefinition> => {
    const res = await workflowApi.post<ProcessFlowDefinition>(`/definitions/${id}/activate`);
    return res.data;
  },
  deactivate: async (id: string): Promise<ProcessFlowDefinition> => {
    const res = await workflowApi.post<ProcessFlowDefinition>(`/definitions/${id}/deactivate`);
    return res.data;
  },
  delete: async (id: string): Promise<void> => {
    await workflowApi.delete(`/definitions/${id}`);
  },
  duplicate: async (id: string, code: string): Promise<ProcessFlowDefinition> => {
    const res = await workflowApi.post<ProcessFlowDefinition>(
      `/definitions/${id}/duplicate`,
      { code },
    );
    return res.data;
  },
  trigger: async (id: string, payload: any) => {
    const res = await workflowApi.post<ProcessFlowRun>(`/definitions/${id}/start`, payload);
    return res.data;
  },
  testRun: async (
    id: string,
    body: { input: Record<string, unknown>; recordId?: string; dryRun: boolean },
  ): Promise<ProcessFlowTestRunResult> => {
    const res = await workflowApi.post<ProcessFlowTestRunResult>(
      `/definitions/${id}/test-run`,
      body,
    );
    return res.data;
  },

  /**
   * Start a Process Flow by its human-authored code. Resolves
   * the code to a definition id (the start endpoint takes UUIDs)
   * and forwards the payload. Used by Workspace QuickActionsPanel
   * which reads `code` from author config.
   */
  triggerByCode: async (code: string, payload: any) => {
    const params: Record<string, string> = { code };
    const listRes = await workflowApi.get<ProcessFlowDefinition[]>('/definitions', { params });
    const def = (listRes.data ?? []).find((d) => d.code === code);
    if (!def) {
      throw new Error(`Process Flow "${code}" not found`);
    }
    const res = await workflowApi.post<ProcessFlowRun>(`/definitions/${def.id}/start`, payload);
    return res.data;
  },
};
