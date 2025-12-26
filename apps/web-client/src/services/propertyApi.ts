import metadataApi from './metadataApi';

// Simplified PropertyDefinition interface for frontend
export interface PropertyDefinition {
  id: string;
  collectionId: string;
  code: string;
  label: string;
  dataType: string;
  isSystem: boolean;
  isRequired: boolean;
  isUnique: boolean;
  displayOrder: number;
  choiceList?: { value: string; label: string; color?: string }[];
  [key: string]: any;
}

export interface CreatePropertyDto {
  code: string;
  label: string;
  dataType: string;
  // ... other fields matching backend DTO
  [key: string]: any;
}

export interface UpdatePropertyDto {
  label?: string;
  // ... other fields matching backend DTO
  [key: string]: any;
}

export const propertyApi = {
  // List properties for a collection
  list: async (collectionId: string) => {
    const response = await metadataApi.get<{ data: PropertyDefinition[]; total: number }>(
      `/collections/${collectionId}/properties`
    );
    return response.data;
  },

  // Get a single property
  get: async (collectionId: string, propertyId: string) => {
    const response = await metadataApi.get<PropertyDefinition>(
      `/collections/${collectionId}/properties/${propertyId}`
    );
    return response.data;
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
