import metadataApi from './metadataApi';

export type GuidedProcessStatus = 'draft' | 'published' | 'deprecated';
export type GuidedActivityKind = 'flow' | 'manual_task' | 'decision';

export interface GuidedProcessActivity {
  id: string;
  stageId: string;
  name: string;
  description?: string | null;
  position: number;
  kind: GuidedActivityKind;
  processFlowCode?: string | null;
  requiredCondition?: Record<string, unknown> | null;
}

export interface GuidedProcessStage {
  id: string;
  processId: string;
  name: string;
  description?: string | null;
  position: number;
  visibilityCondition?: Record<string, unknown> | null;
  activities?: GuidedProcessActivity[];
}

export interface GuidedProcess {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  collectionId: string;
  applicationId?: string | null;
  status: GuidedProcessStatus;
  isActive: boolean;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  stages?: GuidedProcessStage[];
}

export interface CreateGuidedProcessDto {
  code: string;
  name: string;
  description?: string;
  stages: Array<{
    name: string;
    description?: string;
    position?: number;
    visibilityCondition?: Record<string, unknown> | null;
    activities: Array<{
      name: string;
      description?: string;
      position?: number;
      kind: GuidedActivityKind;
      processFlowCode?: string | null;
      requiredCondition?: Record<string, unknown> | null;
    }>;
  }>;
}

export const guidedProcessesApi = {
  list: async (collectionId: string, includeInactive = false): Promise<GuidedProcess[]> => {
    const params: Record<string, string> = {};
    if (includeInactive) params.includeInactive = 'true';
    const response = await metadataApi.get<{ data: GuidedProcess[] }>(
      `/collections/${collectionId}/guided-processes`,
      { params },
    );
    return response.data?.data ?? [];
  },

  get: async (collectionId: string, id: string): Promise<GuidedProcess> => {
    const response = await metadataApi.get<GuidedProcess>(
      `/collections/${collectionId}/guided-processes/${id}`,
    );
    return response.data;
  },

  create: async (collectionId: string, dto: CreateGuidedProcessDto): Promise<GuidedProcess> => {
    const response = await metadataApi.post<GuidedProcess>(
      `/collections/${collectionId}/guided-processes`,
      dto,
    );
    return response.data;
  },

  update: async (
    collectionId: string,
    id: string,
    dto: { name?: string; description?: string; isActive?: boolean },
  ): Promise<GuidedProcess> => {
    const response = await metadataApi.put<GuidedProcess>(
      `/collections/${collectionId}/guided-processes/${id}`,
      dto,
    );
    return response.data;
  },

  replaceStructure: async (
    collectionId: string,
    id: string,
    stages: CreateGuidedProcessDto['stages'],
  ): Promise<GuidedProcess> => {
    const response = await metadataApi.put<GuidedProcess>(
      `/collections/${collectionId}/guided-processes/${id}/structure`,
      { stages },
    );
    return response.data;
  },

  publish: async (collectionId: string, id: string): Promise<GuidedProcess> => {
    const response = await metadataApi.post<GuidedProcess>(
      `/collections/${collectionId}/guided-processes/${id}/publish`,
    );
    return response.data;
  },

  delete: async (collectionId: string, id: string): Promise<void> => {
    await metadataApi.delete<void>(`/collections/${collectionId}/guided-processes/${id}`);
  },
};
