import metadataApi from './metadataApi';

// Collection definition structure using proper HubbleWave terminology
export interface CollectionDefinition {
  id: string;
  code: string;
  label: string;
  pluralLabel?: string;
  description?: string;
  icon?: string;
  category: string;
  moduleId?: string;
  extendsCollectionId?: string;
  storageTable: string;
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

// Legacy alias for backward compatibility
export type TableDefinition = CollectionDefinition;

// Response from GET /collections
export interface CollectionsResponse {
  items: CollectionDefinition[];
  categories?: string[];
  total?: number;
  filtered?: number;
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

// Legacy alias for backward compatibility
export type ColumnInfo = PropertyDefinition;

// Response from GET /collections/:id/properties
export interface PropertiesResponse {
  collectionId: string;
  items: PropertyDefinition[];
  total?: number;
}

// Legacy alias for backward compatibility
export type FieldsResponse = PropertiesResponse;
export type TablesResponse = CollectionsResponse;

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

// Legacy aliases
export type CreateTableDto = CreateCollectionDto;
export type CreateFieldDto = CreatePropertyDto;

export const schemaService = {
  // Get all collections
  getCollections: async (options?: { category?: string; includeSystem?: boolean; search?: string }): Promise<CollectionDefinition[]> => {
    const params = new URLSearchParams();
    if (options?.category) params.append('category', options.category);
    if (options?.includeSystem) params.append('includeSystem', 'true');
    if (options?.search) params.append('search', options.search);

    const response = await metadataApi.get<CollectionsResponse>(`/collections?${params.toString()}`);
    return response.data.items || [];
  },

  // Legacy method - alias for getCollections
  getTables: async (includeHidden = false, category?: string): Promise<CollectionDefinition[]> => {
    return schemaService.getCollections({ category, includeSystem: includeHidden });
  },

  // Get collections with full response including categories
  getCollectionsWithMeta: async (options?: { category?: string; includeSystem?: boolean; search?: string }): Promise<CollectionsResponse> => {
    const params = new URLSearchParams();
    if (options?.category) params.append('category', options.category);
    if (options?.includeSystem) params.append('includeSystem', 'true');
    if (options?.search) params.append('search', options.search);

    const response = await metadataApi.get<CollectionsResponse>(`/collections?${params.toString()}`);
    return response.data;
  },

  // Legacy method - alias
  getTablesWithMeta: async (includeHidden = false, category?: string): Promise<CollectionsResponse> => {
    return schemaService.getCollectionsWithMeta({ category, includeSystem: includeHidden });
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

  // Legacy method - get table by name
  getTable: async (tableName: string, _includeHidden = false): Promise<CollectionDefinition & { fields: PropertyDefinition[] }> => {
    const collection = await schemaService.getCollectionByCode(tableName);
    const properties = await schemaService.getCollectionProperties(collection.id);
    return {
      ...collection,
      fields: properties,
    };
  },

  // Get properties for a collection
  getCollectionProperties: async (collectionId: string): Promise<PropertyDefinition[]> => {
    const response = await metadataApi.get<PropertiesResponse>(`/collections/${collectionId}/properties`);
    return response.data.items || [];
  },

  // Legacy method - alias
  getTableFields: async (tableName: string, _includeHidden = false): Promise<PropertiesResponse> => {
    const collection = await schemaService.getCollectionByCode(tableName);
    const properties = await schemaService.getCollectionProperties(collection.id);
    return {
      collectionId: collection.id,
      items: properties,
      total: properties.length,
    };
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

  // Legacy method - alias
  createTable: async (data: CreateCollectionDto): Promise<CollectionDefinition> => {
    return schemaService.createCollection(data);
  },

  // Update a collection
  updateCollection: async (id: string, data: Partial<CollectionDefinition>): Promise<CollectionDefinition> => {
    const response = await metadataApi.put<CollectionDefinition>(`/collections/${id}`, data);
    return response.data;
  },

  // Legacy method - update table config
  updateTableConfig: async (tableName: string, config: Partial<CollectionDefinition>): Promise<CollectionDefinition> => {
    const collection = await schemaService.getCollectionByCode(tableName);
    return schemaService.updateCollection(collection.id, config);
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

  // Legacy method - alias
  createField: async (tableName: string, data: CreatePropertyDto): Promise<PropertyDefinition> => {
    const collection = await schemaService.getCollectionByCode(tableName);
    return schemaService.createProperty(collection.id, data);
  },

  // Update a property
  updateProperty: async (propertyId: string, data: Partial<PropertyDefinition>): Promise<PropertyDefinition> => {
    const response = await metadataApi.put<PropertyDefinition>(`/properties/${propertyId}`, data);
    return response.data;
  },

  // Legacy method - update field config
  updateFieldConfig: async (tableName: string, columnName: string, config: Partial<PropertyDefinition>): Promise<PropertyDefinition> => {
    const collection = await schemaService.getCollectionByCode(tableName);
    const properties = await schemaService.getCollectionProperties(collection.id);
    const property = properties.find(p => p.code === columnName || p.storageColumn === columnName);
    if (!property) throw new Error(`Property ${columnName} not found`);
    return schemaService.updateProperty(property.id, config);
  },

  // Bulk update properties (placeholder - may need backend support)
  bulkUpdateFields: async (_tableName: string, _fieldCodes: string[], _property: string, _value: unknown) => {
    // This would need a specific backend endpoint
    console.warn('bulkUpdateFields is deprecated - use individual updateProperty calls');
    return { success: false, message: 'Not implemented' };
  },

  // Delete a property
  deleteProperty: async (propertyId: string): Promise<void> => {
    await metadataApi.delete(`/properties/${propertyId}`);
  },

  // Legacy method - hide field
  hideField: async (tableName: string, columnName: string) => {
    const collection = await schemaService.getCollectionByCode(tableName);
    const properties = await schemaService.getCollectionProperties(collection.id);
    const property = properties.find(p => p.code === columnName || p.storageColumn === columnName);
    if (!property) throw new Error(`Property ${columnName} not found`);
    await schemaService.deleteProperty(property.id);
    return { success: true };
  },
};
