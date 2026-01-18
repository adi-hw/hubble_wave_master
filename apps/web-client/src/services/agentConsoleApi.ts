import { createApiClient } from './api';
import { type ListQueryParams, type ListResponse, type WorkItemRecord } from './experienceHubApi';

const api = createApiClient('/api');

export type QueueDefinitionRecord = {
  id: string;
  code?: string;
  name?: string;
  description?: string;
  icon?: string;
  filters?: Record<string, unknown>;
  view_code?: string;
  group_by?: string;
  sort?: Record<string, unknown>;
  is_active?: boolean;
  [key: string]: unknown;
};

export type WorkflowApprovalRecord = {
  id: string;
  processFlowInstanceId: string;
  nodeId?: string;
  approverId?: string;
  status?: string;
  approvalType?: string;
  dueDate?: string;
  comments?: string;
  createdAt?: string;
  updatedAt?: string;
};

export const agentConsoleApi = {
  listQueues: async (params: ListQueryParams = {}) => {
    const response = await api.get<ListResponse<QueueDefinitionRecord>>(
      '/collections/queue_definitions/data',
      { params },
    );
    return response.data;
  },
  listWorkItems: async (params: ListQueryParams = {}) => {
    const response = await api.get<ListResponse<WorkItemRecord>>('/work/items', { params });
    return response.data;
  },
  listApprovalsForInstance: async (processFlowInstanceId?: string) => {
    const response = await api.get<WorkflowApprovalRecord[]>(
      '/workflows/approvals/by-instance',
      { params: { processFlowInstanceId } },
    );
    return response.data;
  },
  listPendingApprovals: async () => {
    const response = await api.get<WorkflowApprovalRecord[]>('/workflows/approvals/pending');
    return response.data;
  },
  approve: async (approvalId: string, comments?: string) => {
    const response = await api.post<WorkflowApprovalRecord>(`/workflows/approvals/${approvalId}/approve`, { comments });
    return response.data;
  },
  reject: async (approvalId: string, comments?: string) => {
    const response = await api.post<WorkflowApprovalRecord>(`/workflows/approvals/${approvalId}/reject`, { comments });
    return response.data;
  },
  delegate: async (approvalId: string, delegatedTo: string, reason?: string) => {
    const response = await api.post<WorkflowApprovalRecord>(`/workflows/approvals/${approvalId}/delegate`, {
      delegatedTo,
      reason,
    });
    return response.data;
  },
};
