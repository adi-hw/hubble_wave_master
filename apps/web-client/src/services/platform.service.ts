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

interface RawModelProperty {
  code?: string;
  label?: string;
  name?: string;
  type?: string;
  dataType?: string;
  backendType?: string;
  uiWidget?: string;
  storagePath?: string;
  nullable?: boolean;
  required?: boolean;
  isRequired?: boolean;
  unique?: boolean;
  isUnique?: boolean;
  defaultValue?: unknown;
  config?: Record<string, unknown>;
  validators?: unknown;
  validationRules?: unknown;
  columnName?: string;
  propertyType?: string | { code?: string; name?: string };
}

interface RawListDataResponse {
  data?: any[];
  records?: any[];
  items?: any[];
  properties?: RawModelProperty[];
  fields?: RawModelProperty[];
  meta?: {
    page?: number;
    limit?: number;
    pageSize?: number;
    total?: number;
    totalPages?: number;
    hasNext?: boolean;
    hasPrev?: boolean;
  };
  page?: number;
  limit?: number;
  pageSize?: number;
  total?: number;
  totalPages?: number;
}

interface RawGetDataResponse {
  record?: any;
  data?: any;
  properties?: RawModelProperty[];
  fields?: RawModelProperty[];
}

const getPropertyTypeCode = (property: RawModelProperty): string => {
  if (property.type) return property.type;
  if (property.dataType) return property.dataType;
  if (property.backendType) return property.backendType;
  if (typeof property.propertyType === 'string') return property.propertyType;
  if (property.propertyType?.code) return property.propertyType.code;
  if (typeof property.config?.dataType === 'string') return property.config.dataType;
  return 'string';
};

export const normalizeModelProperty = (
  property: RawModelProperty,
  collectionCode?: string
): ModelProperty => {
  const code = property.code ?? '';
  const type = getPropertyTypeCode(property);
  const columnName = property.columnName ?? code;

  return {
    code,
    label: property.label ?? property.name ?? code,
    type,
    backendType: property.backendType ?? type,
    uiWidget: property.uiWidget ?? (property.config?.widget as string | undefined) ?? '',
    storagePath:
      property.storagePath ??
      `column:${collectionCode ? `${collectionCode}.` : ''}${columnName}`,
    nullable:
      property.nullable ??
      !(property.isRequired ?? property.required ?? false),
    isUnique: property.isUnique ?? property.unique ?? false,
    defaultValue:
      property.defaultValue === undefined || property.defaultValue === null
        ? undefined
        : String(property.defaultValue),
    config: property.config ?? {},
    validators: property.validators ?? property.validationRules ?? {},
  };
};

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
    metadataApi.get<RawModelProperty[]>(`/models/${collectionCode}/properties`),
  ]);

  return {
    collection: collectionRes.data,
    properties: (propertiesRes.data ?? []).map((property) =>
      normalizeModelProperty(property, collectionCode)
    ),
  };
};

export const getModelProperties = async (collectionCode: string): Promise<ModelProperty[]> => {
  const response = await metadataApi.get<RawModelProperty[]>(`/models/${collectionCode}/properties`);
  return (response.data ?? []).map((property) =>
    normalizeModelProperty(property, collectionCode)
  );
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
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext?: boolean;
    hasPrev?: boolean;
  };
}

const normalizeListDataResponse = (
  response: RawListDataResponse,
  collectionCode: string
): ListDataResponse => {
  const data = response.data ?? response.records ?? response.items ?? [];
  const rawFields = response.properties ?? response.fields ?? [];
  const page = response.meta?.page ?? response.page ?? 1;
  const pageSize = response.meta?.pageSize ?? response.meta?.limit ?? response.pageSize ?? response.limit ?? 20;
  const total = response.meta?.total ?? response.total ?? data.length;
  const totalPages =
    response.meta?.totalPages ??
    response.totalPages ??
    Math.max(1, Math.ceil(total / Math.max(1, pageSize)));

  return {
    data,
    properties: rawFields.map((property) => normalizeModelProperty(property, collectionCode)),
    meta: {
      page,
      limit: pageSize,
      pageSize,
      total,
      totalPages,
      hasNext: response.meta?.hasNext,
      hasPrev: response.meta?.hasPrev,
    },
  };
};

const normalizeGetDataResponse = (
  response: RawGetDataResponse,
  collectionCode: string
): GetDataResponse => ({
  record: response.record ?? response.data ?? response,
  properties: (response.properties ?? response.fields ?? []).map((property) =>
    normalizeModelProperty(property, collectionCode)
  ),
});

export interface ListDataOptions {
  page?: number;
  pageSize?: number;
  limit?: number;
  search?: string;
}

const buildListDataParams = (options?: ListDataOptions): Record<string, string> => {
  const params: Record<string, string> = {};
  if (options?.page !== undefined) params.page = String(options.page);
  const pageSize = options?.pageSize ?? options?.limit;
  if (pageSize !== undefined) {
    params.pageSize = String(pageSize);
    params.limit = String(pageSize);
  }
  if (options?.search) params.search = options.search;
  return params;
};

export const listData = async (
  collectionCode: string,
  options?: ListDataOptions,
): Promise<any[]> => {
  const response = await dataApi.get<RawListDataResponse>(
    `/data/collections/${collectionCode}/data`,
    { params: buildListDataParams(options) },
  );
  return normalizeListDataResponse(response.data ?? {}, collectionCode).data;
};

export const listDataWithMeta = async (
  collectionCode: string,
  options?: ListDataOptions,
): Promise<ListDataResponse> => {
  const response = await dataApi.get<RawListDataResponse>(
    `/data/collections/${collectionCode}/data`,
    { params: buildListDataParams(options) },
  );
  return normalizeListDataResponse(response.data ?? {}, collectionCode);
};

export interface GetDataResponse {
  record: any;
  properties: ModelProperty[];
}

export const createData = async (collectionCode: string, data: any): Promise<any> => {
  const response = await dataApi.post<RawGetDataResponse>(`/data/collections/${collectionCode}/data`, data);
  return normalizeGetDataResponse(response.data ?? {}, collectionCode).record;
};

export const getData = async (collectionCode: string, id: string): Promise<any> => {
  const response = await dataApi.get<RawGetDataResponse>(`/data/collections/${collectionCode}/data/${id}`);
  return normalizeGetDataResponse(response.data ?? {}, collectionCode).record;
};

export const getDataWithProperties = async (collectionCode: string, id: string): Promise<GetDataResponse> => {
  const response = await dataApi.get<RawGetDataResponse>(`/data/collections/${collectionCode}/data/${id}`);
  return normalizeGetDataResponse(response.data ?? {}, collectionCode);
};

export const updateData = async (collectionCode: string, id: string, data: any): Promise<any> => {
  const response = await dataApi.put<RawGetDataResponse>(`/data/collections/${collectionCode}/data/${id}`, data);
  return normalizeGetDataResponse(response.data ?? {}, collectionCode).record;
};

export const deleteData = async (collectionCode: string, id: string) => {
  const response = await dataApi.delete<any>(`/data/collections/${collectionCode}/data/${id}`);
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
  const response = await dataApi.post<any>(`/data/collections/${collectionCode}/data/bulk-update`, {
    ids,
    data: updates,
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
  const response = await dataApi.post<any>(`/data/collections/${collectionCode}/data/bulk-delete`, { ids });
  return response.data;
};
