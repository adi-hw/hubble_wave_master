import metadataApi from './metadataApi';

export interface WorkflowRun {
  id: string;
  status: string;
  input?: any;
  output?: any;
  error?: string;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  slug: string;
  description?: string;
  triggerType: string;
  triggerConfig: any;
  steps: any[];
  status: string;
  runs?: WorkflowRun[];
}

export const workflowsService = {
  list: async (): Promise<WorkflowDefinition[]> => {
    const res = await metadataApi.get<WorkflowDefinition[]>('/workflows');
    return res.data;
  },
  get: async (id: string): Promise<WorkflowDefinition> => {
    const res = await metadataApi.get<WorkflowDefinition>(`/workflows/${id}`);
    return res.data;
  },
  create: async (body: { name: string; slug: string; description?: string; triggerType?: string; triggerConfig?: any; steps?: any[] }) => {
    const res = await metadataApi.post<WorkflowDefinition>('/workflows', body);
    return res.data;
  },
  trigger: async (id: string, payload: any) => {
    const res = await metadataApi.post<WorkflowRun>(`/workflows/${id}/trigger`, { payload });
    return res.data;
  },
};
