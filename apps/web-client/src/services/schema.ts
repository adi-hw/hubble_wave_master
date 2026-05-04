import metadataApi from './metadataApi';

// Collection definition structure using proper HubbleWave terminology
export interface CollectionDefinition {
  id: string;
  code: string;
  label?: string;
  name?: string;
  pluralLabel?: string;
  pluralName?: string;
  description?: string;
  icon?: string;
  category: string;
  moduleId?: string;
  applicationId?: string | null;
  extendsCollectionId?: string;
  storageTable?: string;
  tableName?: string;
  isSystem: boolean;
  isExtensible: boolean;
  status: string;
  schemaVersion: number;
  displayProperty?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
  // For compatibility
  propertyCount?: number;
}

// Response from GET /collections
export interface CollectionsResponse {
  items?: CollectionDefinition[];
  data?: CollectionDefinition[];
  categories?: string[];
  total?: number;
  filtered?: number;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CollectionListOptions {
  category?: string;
  includeSystem?: boolean;
  search?: string;
  moduleId?: string;
  status?: 'draft' | 'published' | 'deprecated';
  page?: number;
  limit?: number;
}

// Property definition structure
export interface PropertyDefinition {
  id: string;
  collectionId: string;
  code: string;
  label: string;
  dataType: string;
  storageColumn: string;
  displayOrder: number;
  isRequired: boolean;
  isUnique: boolean;
  isReadonly: boolean;
  isIndexed: boolean;
  isSystem: boolean;
  isAudited: boolean;
  maxLength?: number;
  minValue?: number;
  maxValue?: number;
  regexPattern?: string;
  defaultValue?: string;
  referenceCollectionId?: string;
  referenceDisplayProperty?: string;
  referenceFilter?: Record<string, unknown>;
  choiceListId?: string;
  allowOther?: boolean;
  helpText?: string;
  placeholder?: string;
  isCalculated?: boolean;
  calculationFormula?: string;
  createdAt: string;
  updatedAt: string;
}

// Response from GET /collections/:id/properties
export interface PropertiesResponse {
  collectionId: string;
  items: PropertyDefinition[];
  total?: number;
}

// Create collection DTO
export interface CreateCollectionDto {
  code: string;
  label: string;
  pluralLabel?: string;
  description?: string;
  icon?: string;
  category?: string;
  moduleId?: string;
  extendsCollectionId?: string;
  isExtensible?: boolean;
  displayProperty?: string;
}

// Create property DTO
export interface CreatePropertyDto {
  code: string;
  label: string;
  dataType: string;
  isRequired?: boolean;
  isUnique?: boolean;
  isReadonly?: boolean;
  isIndexed?: boolean;
  maxLength?: number;
  minValue?: number;
  maxValue?: number;
  regexPattern?: string;
  defaultValue?: string;
  referenceCollectionId?: string;
  referenceDisplayProperty?: string;
  choiceListId?: string;
  allowOther?: boolean;
  helpText?: string;
  placeholder?: string;
  displayOrder?: number;
}

const normalizeCollectionsResponse = (
  response: CollectionsResponse,
): CollectionsResponse => {
  const items = response.items ?? response.data ?? [];
  const total = response.total ?? response.pagination?.total ?? items.length;

  return {
    ...response,
    items,
    data: response.data ?? items,
    total,
    filtered: response.filtered ?? total,
  };
};

export const schemaService = {
  // Get all collections
  getCollections: async (options?: CollectionListOptions): Promise<CollectionDefinition[]> => {
    const params = new URLSearchParams();
    if (options?.category) params.append('category', options.category);
    if (options?.includeSystem) params.append('includeSystem', 'true');
    if (options?.search) params.append('search', options.search);
    if (options?.moduleId) params.append('moduleId', options.moduleId);
    if (options?.status) params.append('status', options.status);
    if (options?.page) params.append('page', String(options.page));
    if (options?.limit) params.append('limit', String(options.limit));

    const response = await metadataApi.get<CollectionsResponse>(`/collections?${params.toString()}`);
    return normalizeCollectionsResponse(response.data).items || [];
  },

  // Get collections with full response including categories
  getCollectionsWithMeta: async (options?: CollectionListOptions): Promise<CollectionsResponse> => {
    const params = new URLSearchParams();
    if (options?.category) params.append('category', options.category);
    if (options?.includeSystem) params.append('includeSystem', 'true');
    if (options?.search) params.append('search', options.search);
    if (options?.moduleId) params.append('moduleId', options.moduleId);
    if (options?.status) params.append('status', options.status);
    if (options?.page) params.append('page', String(options.page));
    if (options?.limit) params.append('limit', String(options.limit));

    const response = await metadataApi.get<CollectionsResponse>(`/collections?${params.toString()}`);
    return normalizeCollectionsResponse(response.data);
  },

  // Get property types
  getPropertyTypes: async () => {
    const response = await metadataApi.get('/collections/property-types');
    return response.data;
  },

  // Get categories
  getCategories: async (): Promise<string[]> => {
    const response = await metadataApi.get<{ items: string[] }>('/collections/categories');
    return response.data.items || [];
  },

  // Get a single collection by ID
  getCollection: async (id: string): Promise<CollectionDefinition> => {
    const response = await metadataApi.get<CollectionDefinition>(`/collections/${id}`);
    return response.data;
  },

  // Get a single collection by code
  getCollectionByCode: async (code: string): Promise<CollectionDefinition> => {
    const response = await metadataApi.get<CollectionDefinition>(`/collections/by-code/${code}`);
    return response.data;
  },

  // Get collection with all properties
  getCollectionWithProperties: async (id: string): Promise<CollectionDefinition & { properties: PropertyDefinition[] }> => {
    const response = await metadataApi.get<CollectionDefinition & { properties: PropertyDefinition[] }>(`/collections/${id}/full`);
    return response.data;
  },

  // Get properties for a collection
  getCollectionProperties: async (collectionId: string): Promise<PropertyDefinition[]> => {
    const response = await metadataApi.get<PropertiesResponse>(`/collections/${collectionId}/properties`);
    return response.data.items || [];
  },

  // Get relationships for a collection
  getCollectionRelationships: async (collectionId: string) => {
    const response = await metadataApi.get(`/collections/${collectionId}/relationships`);
    return response.data;
  },

  // Create a new collection
  createCollection: async (data: CreateCollectionDto): Promise<CollectionDefinition> => {
    const response = await metadataApi.post<CollectionDefinition>('/collections', data);
    return response.data;
  },

  // Update a collection
  updateCollection: async (id: string, data: Partial<CollectionDefinition>): Promise<CollectionDefinition> => {
    const response = await metadataApi.put<CollectionDefinition>(`/collections/${id}`, data);
    return response.data;
  },

  // Delete a collection (soft delete)
  deleteCollection: async (id: string): Promise<void> => {
    await metadataApi.delete(`/collections/${id}`);
  },

  // Publish a collection
  publishCollection: async (id: string): Promise<CollectionDefinition> => {
    const response = await metadataApi.post<CollectionDefinition>(`/collections/${id}/publish`);
    return response.data;
  },

  // Clone a collection
  cloneCollection: async (id: string, code: string, label: string): Promise<CollectionDefinition> => {
    const response = await metadataApi.post<CollectionDefinition>(`/collections/${id}/clone`, { code, label });
    return response.data;
  },

  // Create a property for a collection
  createProperty: async (collectionId: string, data: CreatePropertyDto): Promise<PropertyDefinition> => {
    const response = await metadataApi.post<PropertyDefinition>(`/properties`, {
      ...data,
      collectionId,
    });
    return response.data;
  },

  // Update a property
  updateProperty: async (propertyId: string, data: Partial<PropertyDefinition>): Promise<PropertyDefinition> => {
    const response = await metadataApi.put<PropertyDefinition>(`/properties/${propertyId}`, data);
    return response.data;
  },

  // Delete a property
  deleteProperty: async (propertyId: string): Promise<void> => {
    await metadataApi.delete(`/properties/${propertyId}`);
  },

  // Records the explicit "spreadsheet edit mode entered" audit row for
  // a collection's Records sub-tab (ADR-16). Backend writes to
  // AccessAuditService with operation='spreadsheet_edit_mode_enter'.
  recordSpreadsheetEditModeEntry: async (collectionId: string): Promise<void> => {
    await metadataApi.post<void>(`/collections/${collectionId}/spreadsheet/audit-edit-mode-entry`);
  },

  // ADR-17 publish-preview — classifies the diff between this
  // Collection's most recently published property revisions and the
  // current draft state. Returned classification drives the publish
  // confirm dialog mode: `cosmetic` publishes silently; `structural`
  // proceeds with dependents flagged for review; `breaking` blocks
  // behind explicit acknowledgment.
  getPublishPreview: async (collectionId: string): Promise<PublishImpactReport> => {
    const response = await metadataApi.get<PublishImpactReport>(
      `/collections/${collectionId}/publish-preview`,
    );
    return response.data;
  },

  // ADR-17 dependent-review queue — list of dependents flagged by a
  // structural/breaking publish. Defaults to status='needs_review'.
  listDependentReviewQueue: async (
    options: { collectionId?: string; status?: 'needs_review' | 'acknowledged' | 'dismissed'; limit?: number } = {},
  ): Promise<DependentReviewQueueEntry[]> => {
    const params: Record<string, string> = {};
    if (options.collectionId) params.collectionId = options.collectionId;
    if (options.status) params.status = options.status;
    if (options.limit) params.limit = String(options.limit);
    const response = await metadataApi.get<DependentReviewQueueEntry[]>(
      '/dependent-review-queue',
      { params },
    );
    return response.data;
  },

  countOpenReviews: async (collectionId?: string): Promise<{ open: number }> => {
    const params: Record<string, string> = {};
    if (collectionId) params.collectionId = collectionId;
    const response = await metadataApi.get<{ open: number }>(
      '/dependent-review-queue/count',
      { params },
    );
    return response.data;
  },

  acknowledgeReview: async (
    id: string,
    note?: string,
  ): Promise<DependentReviewQueueEntry> => {
    const response = await metadataApi.post<DependentReviewQueueEntry>(
      `/dependent-review-queue/${id}/acknowledge`,
      { note },
    );
    return response.data;
  },

  dismissReview: async (
    id: string,
    note?: string,
  ): Promise<DependentReviewQueueEntry> => {
    const response = await metadataApi.post<DependentReviewQueueEntry>(
      `/dependent-review-queue/${id}/dismiss`,
      { note },
    );
    return response.data;
  },

  // Schema plan: default is published metadata vs Postgres. App Studio
  // can request the current draft explicitly for read-only preview.
  getSchemaPlan: async (
    collectionCodes?: string[],
    options?: { source?: 'published' | 'draft' },
  ): Promise<SchemaPlan> => {
    const params: Record<string, string> = {};
    if (collectionCodes && collectionCodes.length > 0) {
      params.collectionCodes = collectionCodes.join(',');
    }
    if (options?.source) {
      params.source = options.source;
    }
    const response = await metadataApi.get<SchemaPlan>('/schema/plan', { params });
    return response.data;
  },

  deploySchemaPlan: async (collectionCodes?: string[]): Promise<SchemaDeployResult> => {
    const response = await metadataApi.post<SchemaDeployResult>('/schema/deploy', {
      collectionCodes,
    });
    return response.data;
  },
};

export interface SchemaPlan {
  schema: string;
  generatedAt: string;
  operations: SchemaOperation[];
  issues?: SchemaPlanIssue[];
}

export interface SchemaPlanIssue {
  severity: 'warning' | 'blocking';
  collectionCode: string;
  propertyCode?: string;
  message: string;
}

export type SchemaOperation =
  | {
      type: 'create_table';
      schema: string;
      table: string;
      ddl: string;
    }
  | {
      type: 'add_column';
      schema: string;
      table: string;
      column: {
        name: string;
        type: string;
        nullable: boolean;
        defaultValue?: string;
      };
    }
  | {
      type: 'add_index';
      schema: string;
      table: string;
      indexName: string;
      columns: string[];
      unique: boolean;
    };

export interface SchemaDeployResult {
  plan: SchemaPlan;
  applied: SchemaOperation[];
}

// ADR-17 publish-impact contract — mirrored from svc-metadata
// publish-impact.types.ts. Keep field names in sync.

export type ImpactClassification = 'cosmetic' | 'structural' | 'breaking';
export type PropertyChangeKind = 'added' | 'modified' | 'removed';

export interface FieldChange {
  field: string;
  classification: ImpactClassification;
  from?: unknown;
  to?: unknown;
  reason: string;
}

export interface DependentSummary {
  entityType: string;
  entityId: string;
  entityLabel: string;
  href?: string;
  reason: string;
}

export interface PropertyImpactReport {
  propertyId?: string;
  propertyCode: string;
  propertyLabel?: string;
  changeKind: PropertyChangeKind;
  classification: ImpactClassification;
  fieldChanges: FieldChange[];
  reasons: string[];
  dependents: DependentSummary[];
}

export interface PublishImpactReport {
  collectionId: string;
  collectionCode: string;
  classification: ImpactClassification | 'no_changes';
  propertyChanges: PropertyImpactReport[];
  generatedAt: string;
}

export type DependentReviewStatus = 'needs_review' | 'acknowledged' | 'dismissed';

export interface DependentReviewQueueEntry {
  id: string;
  collectionId: string;
  collectionCode: string;
  propertyCode: string;
  propertyId?: string | null;
  changeKind: PropertyChangeKind;
  classification: 'structural' | 'breaking';
  entityType: string;
  entityId: string;
  entityLabel: string;
  href?: string | null;
  reason: string;
  status: DependentReviewStatus;
  createdAt: string;
  createdBy?: string | null;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
  resolutionNote?: string | null;
}
