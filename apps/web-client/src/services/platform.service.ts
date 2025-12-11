import metadataApi from './metadataApi';
import dataApi from './api';

export interface ModelField {
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

export interface ModelTable {
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
// Metadata Service Calls (port 3333) - Model info, fields, layouts
// ============================================================================

export const getTableMetadata = async (tableCode: string) => {
  const [tableRes, fieldsRes] = await Promise.all([
    metadataApi.get<ModelTable>(`/models/${tableCode}`),
    metadataApi.get<ModelField[]>(`/models/${tableCode}/fields`),
  ]);

  return {
    table: tableRes.data,
    fields: fieldsRes.data,
  };
};

export const getModelFields = async (tableCode: string): Promise<ModelField[]> => {
  const response = await metadataApi.get<ModelField[]>(`/models/${tableCode}/fields`);
  return response.data;
};

export const getModelLayout = async (tableCode: string): Promise<ModelLayout | null> => {
  const response = await metadataApi.get<ModelLayout>(`/models/${tableCode}/layout`);
  return response.data;
};

// ============================================================================
// Data Service Calls (port 3001) - CRUD operations on actual data
// ============================================================================

export interface ListDataResponse {
  data: any[];
  fields: ModelField[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const listData = async (tableCode: string): Promise<any[]> => {
  const response = await dataApi.get<ListDataResponse>(`/data/${tableCode}`);
  // Backend returns { data, fields, meta } - extract just the data array
  return response.data?.data || [];
};

export const listDataWithMeta = async (tableCode: string): Promise<ListDataResponse> => {
  const response = await dataApi.get<ListDataResponse>(`/data/${tableCode}`);
  return response.data;
};

export interface GetDataResponse {
  record: any;
  fields: ModelField[];
}

export const createData = async (tableCode: string, data: any): Promise<any> => {
  const response = await dataApi.post<GetDataResponse>(`/data/${tableCode}`, { data });
  // Backend returns { record, fields } - extract just the record
  return response.data?.record || response.data;
};

export const getData = async (tableCode: string, id: string): Promise<any> => {
  const response = await dataApi.get<GetDataResponse>(`/data/${tableCode}/${id}`);
  // Backend returns { record, fields } - extract just the record
  return response.data?.record || response.data;
};

export const getDataWithFields = async (tableCode: string, id: string): Promise<GetDataResponse> => {
  const response = await dataApi.get<GetDataResponse>(`/data/${tableCode}/${id}`);
  return response.data;
};

export const updateData = async (tableCode: string, id: string, data: any): Promise<any> => {
  const response = await dataApi.patch<GetDataResponse>(`/data/${tableCode}/${id}`, { data });
  // Backend returns { record, fields } - extract just the record
  return response.data?.record || response.data;
};

export const deleteData = async (tableCode: string, id: string) => {
  const response = await dataApi.delete<any>(`/data/${tableCode}/${id}`);
  return response.data;
};

/**
 * Bulk update multiple records with the same field values
 */
export const bulkUpdateRecords = async (
  tableCode: string,
  ids: (string | number)[],
  updates: Record<string, any>
) => {
  const response = await dataApi.patch<any>(`/data/${tableCode}/bulk`, {
    ids,
    updates,
  });
  return response.data;
};

/**
 * Bulk delete multiple records
 */
export const bulkDeleteRecords = async (
  tableCode: string,
  ids: (string | number)[]
) => {
  const response = await dataApi.delete<any>(`/data/${tableCode}/bulk`, {
    data: { ids },
  });
  return response.data;
};
