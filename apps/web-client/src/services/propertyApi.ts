import metadataApi from './metadataApi';

// Frontend PropertyDefinition interface
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
  [key: string]: any;
}

// API response format (matches backend entity)
interface PropertyApiResponse {
  id: string;
  collectionId: string;
  code: string;
  name: string;  // Backend uses 'name', frontend uses 'label'
  propertyTypeId?: string;
  position: number;  // Backend uses 'position', frontend uses 'displayOrder'
  isSystem: boolean;
  isRequired: boolean;
  isUnique: boolean;
  isReadonly: boolean;
  config?: Record<string, unknown>;
  propertyType?: { code: string; name: string };
  [key: string]: any;
}

// Map API response to frontend format
function mapPropertyResponse(apiProp: PropertyApiResponse): PropertyDefinition {
  return {
    ...apiProp,
    label: apiProp.name,  // API 'name' → 'label'
    displayOrder: apiProp.position ?? 0,  // API 'position' → 'displayOrder'
    dataType: apiProp.propertyType?.code || apiProp.config?.type as string || 'text',
    isReadonly: apiProp.isReadonly ?? false,
  };
}

export interface CreatePropertyDto {
  code: string;
  label: string;
  dataType: string;
  [key: string]: any;
}

export interface UpdatePropertyDto {
  label?: string;
  [key: string]: any;
}

export const propertyApi = {
  // List properties for a collection
  list: async (collectionId: string) => {
    const response = await metadataApi.get<PropertyApiResponse[]>(
      `/collections/${collectionId}/properties`
    );
    // API returns array directly, map and wrap for consistency
    const apiProperties = Array.isArray(response.data) ? response.data : [];
    const properties = apiProperties.map(mapPropertyResponse);
    return { data: properties, total: properties.length };
  },

  // Get a single property
  get: async (collectionId: string, propertyId: string) => {
    const response = await metadataApi.get<PropertyApiResponse>(
      `/collections/${collectionId}/properties/${propertyId}`
    );
    return mapPropertyResponse(response.data);
  },

  // Check code availability
  checkAvailability: async (collectionId: string, code: string) => {
    const response = await metadataApi.get<{ available: boolean }>(
      `/collections/${collectionId}/properties/check-availability?code=${code}`
    );
    return response.data;
  },

  // Create a new property
  create: async (collectionId: string, data: CreatePropertyDto) => {
    const response = await metadataApi.post<{ property: PropertyDefinition; warnings: string[] }>(
      `/collections/${collectionId}/properties`,
      data
    );
    return response.data;
  },

  // Update an existing property
  update: async (collectionId: string, propertyId: string, data: UpdatePropertyDto) => {
    const response = await metadataApi.put<PropertyDefinition>(
      `/collections/${collectionId}/properties/${propertyId}`,
      data
    );
    return response.data;
  },

  // Delete a property
  delete: async (collectionId: string, propertyId: string, force = false) => {
    const response = await metadataApi.delete<{ deleted: boolean; dataLost: boolean }>(
      `/collections/${collectionId}/properties/${propertyId}?force=${force}`
    );
    return response.data;
  },

  // Reorder properties
  reorder: async (collectionId: string, order: { id: string; displayOrder: number }[]) => {
    const response = await metadataApi.put<{ updated: number }>(
      `/collections/${collectionId}/properties/reorder`,
      { order }
    );
    return response.data;
  },

  // AVA Suggestions
  suggest: async (collectionId: string, name: string) => {
    const response = await metadataApi.get<Partial<CreatePropertyDto>>(
      `/collections/${collectionId}/properties/suggest?name=${encodeURIComponent(name)}`
    );
    return response.data;
  },

  // AVA Type Detection
  detectType: async (collectionId: string, samples: string[]) => {
    const response = await metadataApi.post<{ dataType: string; confidence: number; formatOptions?: any }>(
      `/collections/${collectionId}/properties/detect-type`,
      { samples }
    );
    return response.data;
  },
};
