import { createApiClient } from './api';

const metadataApi = createApiClient('/api');
const viewEngineApi = createApiClient('/api/view-engine');

export type ViewKind = 'form' | 'list' | 'page';
export type ViewScope = 'system' | 'instance' | 'role' | 'group' | 'personal';

export interface ViewDefinition {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  kind: ViewKind;
  targetCollectionCode?: string | null;
  metadata: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ViewDefinitionRevision {
  id: string;
  definitionId: string;
  revision: number;
  status: 'draft' | 'published';
  layout: Record<string, unknown>;
  widgetBindings: Record<string, unknown>;
  actions: Record<string, unknown>;
  createdAt: string;
  publishedAt?: string | null;
}

export interface ViewVariant {
  id: string;
  definitionId: string;
  scope: ViewScope;
  scopeKey?: string | null;
  priority: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ViewDefinitionListItem {
  definition: ViewDefinition;
  latestRevision: ViewDefinitionRevision | null;
  latestPublishedRevision: ViewDefinitionRevision | null;
  variants: ViewVariant[];
}

export interface CreateViewDraftRequest {
  code: string;
  name: string;
  description?: string;
  kind: ViewKind;
  target_collection_code?: string;
  layout?: Record<string, unknown>;
  widget_bindings?: Record<string, unknown>;
  actions?: Record<string, unknown>;
  variant: {
    scope: ViewScope;
    scope_key?: string;
    priority?: number;
  };
}

export interface PublishViewRequest {
  revisionId?: string;
}

export interface ResolvedView {
  definitionId: string;
  viewCode: string;
  name: string;
  description?: string | null;
  kind: ViewKind;
  targetCollectionCode?: string | null;
  revisionId: string;
  revision: number;
  scope: ViewScope;
  scopeKey?: string | null;
  priority: number;
  layout: Record<string, unknown>;
  fieldPermissions?: Record<string, { canRead: boolean; canWrite: boolean; maskingStrategy: 'NONE' | 'PARTIAL' | 'FULL' }>;
  widgetBindings: Record<string, unknown>;
  actions: Record<string, unknown>;
  publishedAt?: string | null;
  resolvedAt: string;
}

export const viewApi = {
  listDefinitions: async (params: { kind?: ViewKind; collection?: string; code?: string }) => {
    const qs = new URLSearchParams();
    if (params.kind) qs.set('kind', params.kind);
    if (params.collection) qs.set('collection', params.collection);
    if (params.code) qs.set('code', params.code);
    const response = await metadataApi.get<ViewDefinitionListItem[]>(`/views?${qs.toString()}`);
    return response.data;
  },

  createDraft: async (payload: CreateViewDraftRequest) => {
    const response = await metadataApi.post<{ definition: ViewDefinition; variant: ViewVariant; revision: ViewDefinitionRevision }>(
      '/views',
      payload
    );
    return response.data;
  },

  publish: async (viewCode: string, payload: PublishViewRequest = {}) => {
    const response = await metadataApi.post<ViewDefinitionRevision>(`/views/${viewCode}/publish`, payload);
    return response.data;
  },

  listRevisions: async (viewCode: string) => {
    const response = await metadataApi.get<ViewDefinitionRevision[]>(`/views/${viewCode}/revisions`);
    return response.data;
  },

  getRevision: async (viewCode: string, revisionId: string) => {
    const response = await metadataApi.get<ViewDefinitionRevision>(`/views/${viewCode}/revisions/${revisionId}`);
    return response.data;
  },

  addVariant: async (viewCode: string, variant: CreateViewDraftRequest['variant']) => {
    const response = await metadataApi.post<ViewVariant>(`/views/${viewCode}/variants`, variant);
    return response.data;
  },

  resolve: async (params: { route?: string; kind: ViewKind; collection?: string }) => {
    const qs = new URLSearchParams();
    if (params.route) qs.set('route', params.route);
    if (params.kind) qs.set('kind', params.kind);
    if (params.collection) qs.set('collection', params.collection);
    const response = await viewEngineApi.get<ResolvedView>(`/views/resolve?${qs.toString()}`);
    return response.data;
  },
};
