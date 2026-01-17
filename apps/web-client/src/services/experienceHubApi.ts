import { createApiClient } from './api';

const api = createApiClient('/api');

export type ListQueryParams = {
  page?: number;
  pageSize?: number;
  sort?: string;
  filters?: string;
  search?: string;
  searchFields?: string;
  viewId?: string;
};

export type ListResponse<T> = {
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
};

export type OfferingRecord = {
  id: string;
  code?: string;
  name?: string;
  description?: string;
  category?: string;
  icon?: string;
  is_active?: boolean;
  form_view_code?: string;
  workflow_code?: string;
  default_priority?: string;
  submission_schema?: Record<string, unknown>;
  [key: string]: unknown;
};

export type WorkItemRecord = {
  id: string;
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  offering_id?: string;
  offering_code?: string;
  requested_by?: string;
  assigned_to?: string;
  submitted_at?: string;
  due_at?: string;
  workflow_definition_id?: string;
  workflow_instance_id?: string;
  submission_data?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
};

export type SubmitOfferingPayload = {
  offeringId?: string;
  offeringCode?: string;
  title?: string;
  description?: string;
  priority?: string;
  message?: string;
  data?: Record<string, unknown>;
};

export const offeringsApi = {
  list: async (params: ListQueryParams = {}) => {
    const response = await api.get<ListResponse<OfferingRecord>>('/offerings', { params });
    return response.data;
  },
  submit: async (payload: SubmitOfferingPayload) => {
    const response = await api.post<{ offering: OfferingRecord; workItem: WorkItemRecord }>(
      '/offerings/submit',
      payload
    );
    return response.data;
  },
};

export const workApi = {
  list: async (params: ListQueryParams = {}) => {
    const response = await api.get<ListResponse<WorkItemRecord>>('/work/items', { params });
    return response.data;
  },
  get: async (id: string) => {
    const response = await api.get<{ record: WorkItemRecord }>(`/work/items/${id}`);
    return response.data.record;
  },
  addComment: async (id: string, body: string) => {
    const response = await api.post<{ id: string; body: string }>(`/work/items/${id}/comment`, {
      body,
    });
    return response.data;
  },
  transition: async (id: string, payload: { status: string; message?: string }) => {
    const response = await api.post<WorkItemRecord>(`/work/items/${id}/transition`, payload);
    return response.data;
  },
};
