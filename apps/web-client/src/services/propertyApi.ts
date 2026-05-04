import metadataApi from './metadataApi';

// Frontend PropertyDefinition interface — uses canvas-friendly names
// (label, dataType, displayOrder). The mapPropertyResponse adapter
// translates backend (name, propertyType.code, position) into this
// shape, and the create/update payloads translate back when POSTing.
export interface PropertyDefinition {
  id: string;
  collectionId: string;
  code: string;
  label: string;
  dataType: string;
  isSystem: boolean;
  isRequired: boolean;
  isUnique: boolean;
  isReadonly: boolean;
  displayOrder: number;
  choiceList?: { value: string; label: string; color?: string }[];
  referenceCollectionId?: string | null;
  referenceDisplayProperty?: string | null;
  behavioralAttributes?: Record<string, unknown>;
  [key: string]: unknown;
}

interface PropertyApiResponse {
  id: string;
  collectionId: string;
  code: string;
  name: string;
  propertyTypeId?: string;
  position: number;
  isSystem: boolean;
  isRequired: boolean;
  isUnique: boolean;
  isReadonly: boolean;
  config?: Record<string, unknown>;
  propertyType?: { code: string; name: string };
  referenceCollectionId?: string | null;
  referenceDisplayProperty?: string | null;
  behavioralAttributes?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * PropertyService.listProperties returns this shape. The frontend
 * unwraps `data` so the canvas hook can treat the result as a record
 * list with metadata.
 */
interface PropertyListResult {
  data: PropertyApiResponse[];
  meta: {
    collectionId: string;
    total: number;
    includeSystem: boolean;
    includeInactive: boolean;
  };
}

type PropertyListWireResult = PropertyListResult | PropertyApiResponse[];

const unwrapPropertyList = (result: PropertyListWireResult) => {
  if (Array.isArray(result)) {
    return {
      properties: result,
      total: result.length,
    };
  }

  const properties = Array.isArray(result?.data) ? result.data : [];
  return {
    properties,
    total: result?.meta?.total ?? properties.length,
  };
};

const mapPropertyResponse = (apiProp: PropertyApiResponse): PropertyDefinition => ({
  ...apiProp,
  label: apiProp.name,
  displayOrder: apiProp.position ?? 0,
  dataType:
    apiProp.propertyType?.code || (apiProp.config?.type as string) || 'text',
  isReadonly: apiProp.isReadonly ?? false,
});

/**
 * Frontend-shape DTO. The API client translates label → name and
 * dataType → propertyTypeCode at the wire boundary, so callers never
 * need to know the backend's canonical names.
 */
export interface CreatePropertyDto {
  code: string;
  label: string;
  dataType: string;
  isRequired?: boolean;
  isUnique?: boolean;
  isReadonly?: boolean;
  referenceCollectionId?: string | null;
  referenceDisplayProperty?: string | null;
  description?: string;
  validationRules?: Record<string, unknown>;
  defaultValue?: string;
  helpText?: string;
  placeholder?: string;
  behavioralAttributes?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface UpdatePropertyDto {
  label?: string;
  isRequired?: boolean;
  isUnique?: boolean;
  isReadonly?: boolean;
  referenceCollectionId?: string | null;
  referenceDisplayProperty?: string | null;
  description?: string;
  validationRules?: Record<string, unknown>;
  defaultValue?: string;
  helpText?: string;
  placeholder?: string;
  behavioralAttributes?: Record<string, unknown>;
  [key: string]: unknown;
}

const toCreateWirePayload = (dto: CreatePropertyDto): Record<string, unknown> => {
  const { label, dataType, ...rest } = dto;
  return {
    ...rest,
    name: label,
    propertyTypeCode: dataType,
  };
};

const toUpdateWirePayload = (dto: UpdatePropertyDto): Record<string, unknown> => {
  const { label, ...rest } = dto;
  const payload: Record<string, unknown> = { ...rest };
  if (label !== undefined) payload.name = label;
  return payload;
};

export const propertyApi = {
  list: async (collectionId: string) => {
    const response = await metadataApi.get<PropertyListWireResult>(
      `/collections/${collectionId}/properties`,
    );
    const { properties: apiProperties, total } = unwrapPropertyList(response.data);
    return { data: apiProperties.map(mapPropertyResponse), total };
  },

  get: async (collectionId: string, propertyId: string) => {
    const response = await metadataApi.get<PropertyApiResponse>(
      `/collections/${collectionId}/properties/${propertyId}`,
    );
    return mapPropertyResponse(response.data);
  },

  checkAvailability: async (collectionId: string, code: string) => {
    const response = await metadataApi.get<{ available: boolean }>(
      `/collections/${collectionId}/properties/check-availability?code=${code}`,
    );
    return response.data;
  },

  create: async (collectionId: string, data: CreatePropertyDto) => {
    const response = await metadataApi.post<{ property: PropertyApiResponse; warnings?: string[] }>(
      `/collections/${collectionId}/properties`,
      toCreateWirePayload(data),
    );
    const raw = (response.data as unknown as PropertyApiResponse) ?? response.data;
    const property = (raw && 'id' in raw)
      ? mapPropertyResponse(raw)
      : mapPropertyResponse((response.data as { property: PropertyApiResponse }).property);
    return { property, warnings: (response.data as { warnings?: string[] }).warnings ?? [] };
  },

  update: async (collectionId: string, propertyId: string, data: UpdatePropertyDto) => {
    const response = await metadataApi.put<PropertyApiResponse>(
      `/collections/${collectionId}/properties/${propertyId}`,
      toUpdateWirePayload(data),
    );
    return mapPropertyResponse(response.data);
  },

  delete: async (collectionId: string, propertyId: string, force = false) => {
    const response = await metadataApi.delete<{ deleted: boolean; dataLost: boolean }>(
      `/collections/${collectionId}/properties/${propertyId}?force=${force}`,
    );
    return response.data;
  },

  /**
   * Reorder uses the backend's wire-level field name `position`. The
   * frontend's PropertyDraft / canvas uses displayOrder; this method
   * is the only place that translation matters.
   */
  reorder: async (
    collectionId: string,
    order: { id: string; displayOrder: number }[],
  ) => {
    const response = await metadataApi.put<{ updated: number }>(
      `/collections/${collectionId}/properties/reorder`,
      { order: order.map((o) => ({ id: o.id, position: o.displayOrder })) },
    );
    return response.data;
  },

  suggest: async (collectionId: string, name: string) => {
    const response = await metadataApi.get<Partial<CreatePropertyDto>>(
      `/collections/${collectionId}/properties/suggest?name=${encodeURIComponent(name)}`,
    );
    return response.data;
  },

  detectType: async (collectionId: string, samples: string[]) => {
    const response = await metadataApi.post<{
      dataType: string;
      confidence: number;
      explanation?: string;
      formatOptions?: Record<string, unknown>;
    }>(`/collections/${collectionId}/properties/detect-type`, { samples });
    return response.data;
  },
};
