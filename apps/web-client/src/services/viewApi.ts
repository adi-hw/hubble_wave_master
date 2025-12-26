import api from './api';
// Types copied from backend to avoid module dependencies in frontend
export type ViewType = 'grid' | 'board' | 'calendar' | 'timeline' | 'form' | 'gallery' | 'map';
export type ViewVisibility = 'personal' | 'team' | 'role' | 'public';

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

export interface ViewDefinition {
  id: string;
  collectionId: string;
  code: string;
  label: string;
  description?: string;
  icon?: string;
  viewType: ViewType;
  visibility: ViewVisibility;
  isDefaultForOwner: boolean;
  isDefaultForTeam: boolean;
  isDefaultForRole: boolean;
  isDefaultForCollection: boolean;
  config: any; // Simplified for now, can be GridViewConfig | BoardViewConfig
  quickFilters: any[];
  allowEditByOthers: boolean;
  isSystem: boolean;
  isLocked: boolean;
  useCount: number;
  lastUsedAt?: Date;
  createdBy?: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserViewPreferences {
  id: string;
  userId: string;
  viewId: string;
  columnWidths: Record<string, number>;
  columnOrder: string[];
  additionalFilters?: any;
  collapsedSections: string[];
  collapsedGroups: string[];
  lastUsedAt?: Date;
  useCount: number;
}

export interface CreateViewDto {
  collectionId: string;
  label: string;
  viewType: ViewDefinition['viewType'];
  visibility?: ViewVisibility;
  config?: any;
  [key: string]: any;
}

export interface UpdateViewDto extends Partial<ViewDefinition> {
  // Config updates
}

export const viewApi = {
  // List views for a collection
  list: async (collectionId: string, teamId?: string, roleId?: string) => {
    const params = new URLSearchParams();
    if (teamId) params.append('teamId', teamId);
    if (roleId) params.append('roleId', roleId);
    
    // Fallback if endpoint doesn't exist yet, return empty
    try {
        const response = await api.get<ViewDefinition[]>(
            `/collections/${collectionId}/views?${params.toString()}`
        );
        return response.data;
    } catch (e) {
        console.warn('View API not available', e);
        return [];
    }
  },

  // Get a single view
  get: async (collectionId: string, viewId: string) => {
    const response = await api.get<ViewDefinition>(
      `/collections/${collectionId}/views/${viewId}`
    );
    return response.data;
  },

  // Create a new view
  create: async (collectionId: string, data: Partial<CreateViewDto>) => {
    const response = await api.post<ViewDefinition>(
      `/collections/${collectionId}/views`,
      data
    );
    return response.data;
  },

  // Update a view
  update: async (collectionId: string, viewId: string, data: Partial<UpdateViewDto>) => {
    const response = await api.put<ViewDefinition>(
      `/collections/${collectionId}/views/${viewId}`,
      data
    );
    return response.data;
  },

  // Delete a view
  delete: async (collectionId: string, viewId: string) => {
    const response = await api.delete<void>(
      `/collections/${collectionId}/views/${viewId}`
    );
    return response.data;
  },

  // Get User Preferences
  getPreferences: async (collectionId: string, viewId: string) => {
    const response = await api.get<UserViewPreferences>(
      `/collections/${collectionId}/views/${viewId}/preferences`
    );
    return response.data;
  },

  // Update User Preferences
  updatePreferences: async (collectionId: string, viewId: string, data: Partial<UserViewPreferences>) => {
    const response = await api.put<UserViewPreferences>(
      `/collections/${collectionId}/views/${viewId}/preferences`,
      data
    );
    return response.data;
  },

  // AVA: Generate View
  generateFromPrompt: async (collectionId: string, prompt: string) => {
    const response = await api.post<Partial<ViewDefinition>>(
      `/collections/${collectionId}/views/ava/generate`,
      { prompt }
    );
    return response.data;
  }
};
