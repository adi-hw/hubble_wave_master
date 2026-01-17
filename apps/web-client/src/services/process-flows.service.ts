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

export interface ProcessFlowDefinition {
  id: string;
  code: string;
  name: string;
  description?: string;
  triggerType: string;
  triggerConditions?: Record<string, unknown>;
  triggerSchedule?: string;
  triggerFilter?: Record<string, unknown>;
  isActive: boolean;
  canvas: { nodes: any[]; connections: any[] };
}

export const processFlowsService = {
  list: async (): Promise<ProcessFlowDefinition[]> => {
    const res = await workflowApi.get<ProcessFlowDefinition[]>('/definitions');
    return res.data;
  },
  get: async (id: string): Promise<ProcessFlowDefinition> => {
    const res = await workflowApi.get<ProcessFlowDefinition>(`/definitions/${id}`);
    return res.data;
  },
  create: async (body: {
    code: string;
    name: string;
    description?: string;
    triggerType?: string;
    triggerConditions?: Record<string, unknown>;
    triggerSchedule?: string;
    triggerFilter?: Record<string, unknown>;
    canvas?: { nodes: any[]; connections: any[] };
  }) => {
    const res = await workflowApi.post<ProcessFlowDefinition>('/definitions', body);
    return res.data;
  },
  trigger: async (id: string, payload: any) => {
    const res = await workflowApi.post<ProcessFlowRun>(`/definitions/${id}/start`, payload);
    return res.data;
  },
};
