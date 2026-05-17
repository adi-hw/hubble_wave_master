import metadataApi from './metadataApi';

export type DisplayRuleStatus = 'draft' | 'published' | 'deprecated';

export type DisplayActionKind =
  | 'show'
  | 'hide'
  | 'mandatory'
  | 'optional'
  | 'readonly'
  | 'editable'
  | 'setValue';

export interface DisplayAction {
  propertyCode: string;
  action: DisplayActionKind;
  value?: unknown;
}

export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'greater_than'
  | 'greater_than_or_equals'
  | 'less_than'
  | 'less_than_or_equals'
  | 'in'
  | 'not_in'
  | 'is_null'
  | 'is_not_null';

export interface SingleCondition {
  property: string;
  operator: ConditionOperator;
  value?: unknown;
}

export interface ConditionGroup {
  and?: Condition[];
  or?: Condition[];
}

export type Condition = ConditionGroup | SingleCondition;

export interface DisplayRule {
  id: string;
  name: string;
  description?: string | null;
  collectionId: string;
  applicationId?: string | null;
  condition: Condition | Record<string, unknown>;
  actions: DisplayAction[];
  priority: number;
  isActive: boolean;
  status: DisplayRuleStatus;
  currentRevisionId?: string | null;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DisplayRuleDto {
  name: string;
  description?: string;
  condition: Condition | Record<string, unknown>;
  actions: DisplayAction[];
  priority?: number;
  isActive?: boolean;
}

export const displayRulesApi = {
  /**
   * The editor surface (DisplayRulesPanel) MUST pass
   * `includeDrafts=true` so authors see their in-progress rules; the
   * backend default returns only published rules so runtime callers
   * (resolveView) never see drafts. Backend gates the drafts flag
   * behind `metadata:policy:manage`.
   */
  list: async (
    collectionId: string,
    options: { includeInactive?: boolean; includeDrafts?: boolean } = {},
  ): Promise<DisplayRule[]> => {
    const params: Record<string, string> = {};
    if (options.includeInactive) params.includeInactive = 'true';
    if (options.includeDrafts) params.includeDrafts = 'true';
    const response = await metadataApi.get<{ data: DisplayRule[] }>(
      `/collections/${collectionId}/display-rules`,
      { params },
    );
    return response.data?.data ?? [];
  },

  get: async (collectionId: string, id: string): Promise<DisplayRule> => {
    const response = await metadataApi.get<DisplayRule>(
      `/collections/${collectionId}/display-rules/${id}`,
    );
    return response.data;
  },

  create: async (collectionId: string, dto: DisplayRuleDto): Promise<DisplayRule> => {
    const response = await metadataApi.post<DisplayRule>(
      `/collections/${collectionId}/display-rules`,
      dto,
    );
    return response.data;
  },

  update: async (
    collectionId: string,
    id: string,
    dto: Partial<DisplayRuleDto>,
  ): Promise<DisplayRule> => {
    const response = await metadataApi.put<DisplayRule>(
      `/collections/${collectionId}/display-rules/${id}`,
      dto,
    );
    return response.data;
  },

  publish: async (collectionId: string, id: string): Promise<DisplayRule> => {
    const response = await metadataApi.post<DisplayRule>(
      `/collections/${collectionId}/display-rules/${id}/publish`,
    );
    return response.data;
  },

  delete: async (collectionId: string, id: string): Promise<void> => {
    await metadataApi.delete<void>(`/collections/${collectionId}/display-rules/${id}`);
  },
};
