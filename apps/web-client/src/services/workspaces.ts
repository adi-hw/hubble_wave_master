import metadataApi from './metadataApi';

export type WorkspaceStatus = 'draft' | 'published' | 'deprecated';

export type WorkspacePageKind = 'home' | 'list' | 'record' | 'search' | 'analytics' | 'custom';

export interface PanelLayout {
  id: string;
  panelCode: string;
  config: Record<string, unknown>;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WorkspacePage {
  id: string;
  workspaceId: string;
  code: string;
  name: string;
  kind: WorkspacePageKind;
  position: number;
  layout: PanelLayout[];
  collectionId?: string | null;
  source: string;
}

export interface WorkspaceDefinition {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  applicationId: string;
  defaultCollectionId?: string | null;
  themeCode?: string | null;
  source: string;
  status: WorkspaceStatus;
  isActive: boolean;
  publishedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  pages?: WorkspacePage[];
}

export interface CreateWorkspaceDto {
  code: string;
  name: string;
  applicationId: string;
  description?: string;
  defaultCollectionId?: string;
  themeCode?: string;
}

export interface UpsertPageDto {
  code: string;
  name: string;
  kind: WorkspacePageKind;
  position?: number;
  layout?: PanelLayout[];
  collectionId?: string | null;
  source?: string;
}

export const workspacesApi = {
  list: async (applicationId?: string, includeInactive = false) => {
    const params: Record<string, string> = {};
    if (applicationId) params.applicationId = applicationId;
    if (includeInactive) params.includeInactive = 'true';
    const res = await metadataApi.get<{ data: WorkspaceDefinition[] }>('/workspaces', { params });
    return res.data?.data ?? [];
  },

  get: async (id: string) => {
    const res = await metadataApi.get<WorkspaceDefinition>(`/workspaces/${id}`);
    return res.data;
  },

  create: async (dto: CreateWorkspaceDto) => {
    const res = await metadataApi.post<WorkspaceDefinition>('/workspaces', dto);
    return res.data;
  },

  update: async (id: string, dto: Partial<CreateWorkspaceDto> & { isActive?: boolean }) => {
    const res = await metadataApi.put<WorkspaceDefinition>(`/workspaces/${id}`, dto);
    return res.data;
  },

  publish: async (id: string) => {
    const res = await metadataApi.post<WorkspaceDefinition>(`/workspaces/${id}/publish`);
    return res.data;
  },

  deprecate: async (id: string) => {
    const res = await metadataApi.post<WorkspaceDefinition>(`/workspaces/${id}/deprecate`);
    return res.data;
  },

  toggleActive: async (id: string) => {
    const res = await metadataApi.post<WorkspaceDefinition>(`/workspaces/${id}/toggle`);
    return res.data;
  },

  delete: async (id: string) => {
    await metadataApi.delete(`/workspaces/${id}`);
  },

  upsertPage: async (workspaceId: string, pageId: string | null, dto: UpsertPageDto) => {
    if (pageId) {
      const res = await metadataApi.put<WorkspacePage>(
        `/workspaces/${workspaceId}/pages/${pageId}`,
        dto,
      );
      return res.data;
    }
    const res = await metadataApi.post<WorkspacePage>(`/workspaces/${workspaceId}/pages`, dto);
    return res.data;
  },

  resolveLayout: async (workspaceId: string, pageId: string) => {
    const res = await metadataApi.get<{ layout: PanelLayout[] }>(
      `/workspaces/${workspaceId}/pages/${pageId}/resolved-layout`,
    );
    return res.data.layout;
  },
};
