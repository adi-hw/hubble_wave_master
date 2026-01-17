import api from './metadataApi';

export interface PropertyDefinition {
  name: string;
  type: string;
  required?: boolean;
  [key: string]: any;
}

export interface CollectionDefinition {
  id: string;
  tableName: string; // Storage table name (database layer)
  displayName: string;
  description?: string;
  category?: string;
  storageTable?: string;
  storageSchema?: string;
  flags?: Record<string, any>;
  properties?: PropertyDefinition[];
  createdAt: string;
  updatedAt?: string;
}

/**
 * Create a new collection with properties.
 */
export const createCollection = async (
  collectionName: string,
  displayName: string,
  properties: PropertyDefinition[]
): Promise<CollectionDefinition> => {
  const response = await api.post<CollectionDefinition>('/tables', {
    name: collectionName,
    tableName: collectionName,
    displayName,
    fields: properties,
  });
  return response.data;
};
