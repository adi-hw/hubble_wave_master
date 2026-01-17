import metadataApi from './metadataApi';
import dataApi from './api';

export interface ModelProperty {
  code: string;
  label: string;
  type: string;
  backendType: string;
  uiWidget: string;
  storagePath: string;
  nullable: boolean;
  isUnique: boolean;
  defaultValue?: string;
  config: any;
  validators: any;
}

export interface ModelCollection {
  id: string;
  code: string;
  label: string;
  category: string;
  flags: any;
}

export interface ModelLayout {
  id: string;
  name: string;
  layout: any;
}

// ============================================================================
// Metadata Service Calls (port 3333) - Model info, properties, layouts
// ============================================================================

export const getCollectionMetadata = async (collectionCode: string) => {
  const [collectionRes, propertiesRes] = await Promise.all([
    metadataApi.get<ModelCollection>(`/models/${collectionCode}`),
    metadataApi.get<ModelProperty[]>(`/models/${collectionCode}/properties`),
  ]);

  return {
    collection: collectionRes.data,
    properties: propertiesRes.data,
  };
};

export const getModelProperties = async (collectionCode: string): Promise<ModelProperty[]> => {
  const response = await metadataApi.get<ModelProperty[]>(`/models/${collectionCode}/properties`);
  return response.data;
};

export const getModelLayout = async (collectionCode: string): Promise<ModelLayout | null> => {
  const response = await metadataApi.get<ModelLayout>(`/models/${collectionCode}/layout`);
  return response.data;
};

// ============================================================================
// Data Service Calls (port 3001) - CRUD operations on actual data
// ============================================================================

export interface ListDataResponse {
  data: any[];
  properties: ModelProperty[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const listData = async (collectionCode: string): Promise<any[]> => {
  const response = await dataApi.get<ListDataResponse>(`/data/${collectionCode}`);
  return response.data?.data || [];
};

export const listDataWithMeta = async (collectionCode: string): Promise<ListDataResponse> => {
  const response = await dataApi.get<ListDataResponse>(`/data/${collectionCode}`);
  return response.data;
};

export interface GetDataResponse {
  record: any;
  properties: ModelProperty[];
}

export const createData = async (collectionCode: string, data: any): Promise<any> => {
  const response = await dataApi.post<GetDataResponse>(`/data/${collectionCode}`, { data });
  return response.data?.record || response.data;
};

export const getData = async (collectionCode: string, id: string): Promise<any> => {
  const response = await dataApi.get<GetDataResponse>(`/data/${collectionCode}/${id}`);
  return response.data?.record || response.data;
};

export const getDataWithProperties = async (collectionCode: string, id: string): Promise<GetDataResponse> => {
  const response = await dataApi.get<GetDataResponse>(`/data/${collectionCode}/${id}`);
  return response.data;
};

export const updateData = async (collectionCode: string, id: string, data: any): Promise<any> => {
  const response = await dataApi.patch<GetDataResponse>(`/data/${collectionCode}/${id}`, { data });
  return response.data?.record || response.data;
};

export const deleteData = async (collectionCode: string, id: string) => {
  const response = await dataApi.delete<any>(`/data/${collectionCode}/${id}`);
  return response.data;
};

/**
 * Bulk update multiple records with the same property values
 */
export const bulkUpdateRecords = async (
  collectionCode: string,
  ids: (string | number)[],
  updates: Record<string, any>
) => {
  const response = await dataApi.patch<any>(`/data/${collectionCode}/bulk`, {
    ids,
    updates,
  });
  return response.data;
};

/**
 * Bulk delete multiple records
 */
export const bulkDeleteRecords = async (
  collectionCode: string,
  ids: (string | number)[]
) => {
  const response = await dataApi.delete<any>(`/data/${collectionCode}/bulk`, {
    data: { ids },
  });
  return response.data;
};
