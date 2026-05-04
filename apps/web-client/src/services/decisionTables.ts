import metadataApi from './metadataApi';

export type DecisionInputType =
  | 'string'
  | 'integer'
  | 'boolean'
  | 'choice'
  | 'reference'
  | 'date';

export type DecisionRowOperator =
  | 'equals'
  | 'not_equals'
  | 'in'
  | 'not_in'
  | 'greater_than'
  | 'greater_than_or_equals'
  | 'less_than'
  | 'less_than_or_equals'
  | 'is_null'
  | 'is_not_null';

export interface DecisionRowCondition {
  inputId: string;
  operator: DecisionRowOperator;
  value?: unknown;
}

export interface DecisionInput {
  id: string;
  tableId: string;
  name: string;
  inputType: DecisionInputType;
  config?: Record<string, unknown> | null;
  defaultValue?: unknown;
  position: number;
}

export interface DecisionRow {
  id: string;
  tableId: string;
  position: number;
  conditions: DecisionRowCondition[];
  answerRecordId?: string | null;
  answerLiteral?: unknown;
  description?: string | null;
  isActive: boolean;
}

export interface DecisionTable {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  collectionId: string;
  applicationId?: string | null;
  answerCollectionCode?: string | null;
  hitPolicy: 'first_match' | 'all_matches';
  status: 'draft' | 'published' | 'deprecated';
  isActive: boolean;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  inputs?: DecisionInput[];
  rows?: DecisionRow[];
}

export interface CreateDecisionTableDto {
  code: string;
  name: string;
  description?: string;
  answerCollectionCode?: string;
  hitPolicy?: 'first_match' | 'all_matches';
  inputs: Array<{
    name: string;
    inputType: DecisionInputType;
    config?: Record<string, unknown>;
    defaultValue?: unknown;
    position?: number;
  }>;
}

export interface UpsertRowDto {
  position: number;
  conditions: DecisionRowCondition[];
  answerRecordId?: string | null;
  answerLiteral?: unknown;
  description?: string;
  isActive?: boolean;
}

export interface EvaluateResult {
  matched: boolean;
  rowId?: string;
  rowPosition?: number;
  answer?: unknown;
  matches?: Array<{ rowId: string; rowPosition: number; answer: unknown }>;
}

export const decisionTablesApi = {
  list: async (collectionId: string, includeInactive = false): Promise<DecisionTable[]> => {
    const params: Record<string, string> = {};
    if (includeInactive) params.includeInactive = 'true';
    const response = await metadataApi.get<{ data: DecisionTable[] }>(
      `/collections/${collectionId}/decision-tables`,
      { params },
    );
    return response.data?.data ?? [];
  },

  get: async (collectionId: string, id: string): Promise<DecisionTable> => {
    const response = await metadataApi.get<DecisionTable>(
      `/collections/${collectionId}/decision-tables/${id}`,
    );
    return response.data;
  },

  create: async (collectionId: string, dto: CreateDecisionTableDto): Promise<DecisionTable> => {
    const response = await metadataApi.post<DecisionTable>(
      `/collections/${collectionId}/decision-tables`,
      dto,
    );
    return response.data;
  },

  update: async (
    collectionId: string,
    id: string,
    dto: Partial<CreateDecisionTableDto> & { isActive?: boolean },
  ): Promise<DecisionTable> => {
    const response = await metadataApi.put<DecisionTable>(
      `/collections/${collectionId}/decision-tables/${id}`,
      dto,
    );
    return response.data;
  },

  publish: async (collectionId: string, id: string): Promise<DecisionTable> => {
    const response = await metadataApi.post<DecisionTable>(
      `/collections/${collectionId}/decision-tables/${id}/publish`,
    );
    return response.data;
  },

  delete: async (collectionId: string, id: string): Promise<void> => {
    await metadataApi.delete<void>(`/collections/${collectionId}/decision-tables/${id}`);
  },

  createRow: async (
    collectionId: string,
    id: string,
    dto: UpsertRowDto,
  ): Promise<DecisionRow> => {
    const response = await metadataApi.post<DecisionRow>(
      `/collections/${collectionId}/decision-tables/${id}/rows`,
      dto,
    );
    return response.data;
  },

  updateRow: async (
    collectionId: string,
    id: string,
    rowId: string,
    dto: UpsertRowDto,
  ): Promise<DecisionRow> => {
    const response = await metadataApi.put<DecisionRow>(
      `/collections/${collectionId}/decision-tables/${id}/rows/${rowId}`,
      dto,
    );
    return response.data;
  },

  deleteRow: async (collectionId: string, id: string, rowId: string): Promise<void> => {
    await metadataApi.delete<void>(
      `/collections/${collectionId}/decision-tables/${id}/rows/${rowId}`,
    );
  },

  evaluate: async (
    collectionId: string,
    id: string,
    inputs: Record<string, unknown>,
  ): Promise<EvaluateResult> => {
    const response = await metadataApi.post<EvaluateResult>(
      `/collections/${collectionId}/decision-tables/${id}/evaluate`,
      { inputs },
    );
    return response.data;
  },

  /** Editor-only — evaluate a draft table; requires metadata.flows.edit. */
  evaluateDraft: async (
    collectionId: string,
    id: string,
    inputs: Record<string, unknown>,
  ): Promise<EvaluateResult> => {
    const response = await metadataApi.post<EvaluateResult>(
      `/collections/${collectionId}/decision-tables/${id}/evaluate-draft`,
      { inputs },
    );
    return response.data;
  },
};
