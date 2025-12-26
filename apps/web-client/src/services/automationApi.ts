import authenticatedClient from './api';

export interface Automation {
  id: string;
  collectionId: string;
  name: string;
  description?: string;
  triggerTiming: 'before_insert' | 'before_update' | 'before_delete' | 'after_insert' | 'after_update' | 'after_delete' | 'manual' | 'schedule';
  triggerOnInsert: boolean;
  triggerOnUpdate: boolean;
  triggerOnDelete: boolean;
  triggerOnQuery: boolean;
  conditionType: 'always' | 'condition' | 'script';
  condition?: Record<string, unknown>;
  conditionScript?: string;
  actionType: 'no_code' | 'script' | 'flow';
  actions?: AutomationAction[];
  script?: string;
  flowId?: string;
  isActive: boolean;
  executionOrder: number;
  abortOnError: boolean;
  watchProperties?: string[];
  lastRunAt?: string;
  lastRunStatus?: string;
}

export type AutomationRule = Automation;

export interface AutomationAction {
  id: string;
  type: string;
  executionOrder: number;
  config: Record<string, unknown>;
  condition?: Record<string, unknown>;
  continueOnError: boolean;
}

export interface AutomationExecutionLog {
  id: string;
  automationId: string;
  automationName?: string;
  status: 'success' | 'warning' | 'error' | 'skipped';
  startedAt: string;
  completedAt: string;
  durationMs: number;
  triggeredBy: string;
  errorMessage?: string;
  actionsExecuted?: any[];
}

export interface CreateAutomationDto extends Partial<Automation> {
  collectionId: string;
  code: string;
  name: string;
  triggerTiming: Automation['triggerTiming'];
}

export interface ReorderAutomationDto {
  id: string;
  executionOrder: number;
}

export const automationApi = {
  // Automations
  getAutomations: async (collectionId: string, includeInactive = false) => {
    const response = await authenticatedClient.get<Automation[]>(
      `/api/collections/${collectionId}/automations`,
      { params: { includeInactive } }
    );
    return response.data;
  },

  getAutomation: async (id: string) => {
    const response = await authenticatedClient.get<Automation>(`/api/automations/${id}`);
    return response.data;
  },

  createAutomation: async (collectionId: string, data: CreateAutomationDto) => {
    const response = await authenticatedClient.post<Automation>(
      `/api/collections/${collectionId}/automations`,
      data
    );
    return response.data;
  },

  updateAutomation: async (id: string, data: Partial<Automation>) => {
    const response = await authenticatedClient.patch<Automation>(`/api/automations/${id}`, data);
    return response.data;
  },

  deleteAutomation: async (id: string) => {
    await authenticatedClient.delete(`/api/automations/${id}`);
  },

  toggleActive: async (id: string) => {
    const response = await authenticatedClient.post<Automation>(`/api/automations/${id}/toggle`);
    return response.data;
  },

  reorderAutomations: async (collectionId: string, automations: ReorderAutomationDto[]) => {
    await authenticatedClient.post(`/api/collections/${collectionId}/automations/reorder`, {
      automations,
    });
  },

  testAutomation: async (id: string, mockRecord: any, mockPreviousRecord?: any) => {
    const response = await authenticatedClient.post(`/api/automations/${id}/test`, {
      mockRecord,
      mockPreviousRecord,
    });
    return response.data;
  },

  // Display Rules
  getDisplayRules: async (collectionId: string, viewId?: string) => {
    const response = await authenticatedClient.get(
      `/api/collections/${collectionId}/display-rules`,
      { params: { viewId } }
    );
    return response.data;
  },

  createDisplayRule: async (collectionId: string, data: any) => {
    const response = await authenticatedClient.post(
      `/api/collections/${collectionId}/display-rules`,
      data
    );
    return response.data;
  },

  deleteDisplayRule: async (id: string) => {
    await authenticatedClient.delete(`/api/display-rules/${id}`);
  },

  // Logs
  getLogs: async (collectionId: string, page = 1, limit = 50) => {
    const response = await authenticatedClient.get(
      `/api/collections/${collectionId}/automation-logs`,
      { params: { page, limit } }
    );
    return response.data;
  }
};
