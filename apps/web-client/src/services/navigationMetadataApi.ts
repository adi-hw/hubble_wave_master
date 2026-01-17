import { createApiClient } from './api';

const metadataApi = createApiClient('/api');
const resolveApi = createApiClient('/api');

export type NavigationScope = 'system' | 'instance' | 'role' | 'group' | 'personal';

export interface NavigationModule {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  metadata: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NavigationModuleRevision {
  id: string;
  moduleId: string;
  revision: number;
  status: 'draft' | 'published';
  layout: Record<string, unknown>;
  createdAt: string;
  publishedAt?: string | null;
}

export interface NavigationVariant {
  id: string;
  moduleId: string;
  scope: NavigationScope;
  scopeKey?: string | null;
  priority: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NavigationModuleListItem {
  module: NavigationModule;
  latestRevision: NavigationModuleRevision | null;
  latestPublishedRevision: NavigationModuleRevision | null;
  variants: NavigationVariant[];
}

export interface CreateNavigationDraftRequest {
  code: string;
  name: string;
  description?: string;
  layout?: Record<string, unknown>;
  variant: {
    scope: NavigationScope;
    scope_key?: string;
    priority?: number;
  };
}

export interface PublishNavigationRequest {
  revisionId?: string;
}

export interface ResolvedNavigationModule {
  moduleId: string;
  navigationCode: string;
  name: string;
  description?: string | null;
  revisionId: string;
  revision: number;
  scope: NavigationScope;
  scopeKey?: string | null;
  priority: number;
  layout: Record<string, unknown>;
  publishedAt?: string | null;
  resolvedAt: string;
}

export const navigationMetadataApi = {
  listModules: async (params: { code?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.code) qs.set('code', params.code);
    const response = await metadataApi.get<NavigationModuleListItem[]>(`/navigation?${qs.toString()}`);
    return response.data;
  },

  createDraft: async (payload: CreateNavigationDraftRequest) => {
    const response = await metadataApi.post<{
      module: NavigationModule;
      variant: NavigationVariant;
      revision: NavigationModuleRevision;
    }>('/navigation', payload);
    return response.data;
  },

  publish: async (navigationCode: string, payload: PublishNavigationRequest = {}) => {
    const response = await metadataApi.post<NavigationModuleRevision>(
      `/navigation/${navigationCode}/publish`,
      payload
    );
    return response.data;
  },

  listRevisions: async (navigationCode: string) => {
    const response = await metadataApi.get<NavigationModuleRevision[]>(
      `/navigation/${navigationCode}/revisions`
    );
    return response.data;
  },

  getRevision: async (navigationCode: string, revisionId: string) => {
    const response = await metadataApi.get<NavigationModuleRevision>(
      `/navigation/${navigationCode}/revisions/${revisionId}`
    );
    return response.data;
  },

  addVariant: async (navigationCode: string, variant: CreateNavigationDraftRequest['variant']) => {
    const response = await metadataApi.post<NavigationVariant>(
      `/navigation/${navigationCode}/variants`,
      variant
    );
    return response.data;
  },

  resolve: async (params: { code?: string }) => {
    const qs = new URLSearchParams();
    if (params.code) qs.set('code', params.code);
    const response = await resolveApi.get<ResolvedNavigationModule>(
      `/navigation/resolve?${qs.toString()}`
    );
    return response.data;
  },
};
