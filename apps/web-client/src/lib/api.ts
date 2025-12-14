// API Utilities for HubbleWave

const API_BASE = '/api';

interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

/**
 * Enhanced fetch with error handling and JSON support
 */
export async function apiFetch<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { params, ...fetchOptions } = options;

  let url = `${API_BASE}${endpoint}`;

  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  const response = await fetch(url, {
    ...fetchOptions,
    headers: {
      'Content-Type': 'application/json',
      ...fetchOptions.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'An error occurred' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  // Handle empty responses
  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}

/**
 * GET request
 */
export async function apiGet<T>(endpoint: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
  return apiFetch<T>(endpoint, { method: 'GET', params });
}

/**
 * POST request
 */
export async function apiPost<T>(endpoint: string, data?: unknown): Promise<T> {
  return apiFetch<T>(endpoint, {
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * PUT request
 */
export async function apiPut<T>(endpoint: string, data?: unknown): Promise<T> {
  return apiFetch<T>(endpoint, {
    method: 'PUT',
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * PATCH request
 */
export async function apiPatch<T>(endpoint: string, data?: unknown): Promise<T> {
  return apiFetch<T>(endpoint, {
    method: 'PATCH',
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * DELETE request
 */
export async function apiDelete<T>(endpoint: string): Promise<T> {
  return apiFetch<T>(endpoint, { method: 'DELETE' });
}

// Metadata API endpoints
export const metadataApi = {
  // Collections
  getCollections: () => apiGet<unknown[]>('/metadata/collections'),
  getCollection: (id: string) => apiGet<unknown>(`/metadata/collections/${id}`),
  createCollection: (data: unknown) => apiPost<unknown>('/metadata/collections', data),
  updateCollection: (id: string, data: unknown) => apiPatch<unknown>(`/metadata/collections/${id}`, data),
  deleteCollection: (id: string) => apiDelete<void>(`/metadata/collections/${id}`),

  // Properties
  getProperties: (collectionId: string) => apiGet<unknown[]>(`/metadata/collections/${collectionId}/properties`),
  getProperty: (collectionId: string, propertyId: string) =>
    apiGet<unknown>(`/metadata/collections/${collectionId}/properties/${propertyId}`),
  createProperty: (collectionId: string, data: unknown) =>
    apiPost<unknown>(`/metadata/collections/${collectionId}/properties`, data),
  updateProperty: (collectionId: string, propertyId: string, data: unknown) =>
    apiPatch<unknown>(`/metadata/collections/${collectionId}/properties/${propertyId}`, data),
  deleteProperty: (collectionId: string, propertyId: string) =>
    apiDelete<void>(`/metadata/collections/${collectionId}/properties/${propertyId}`),

  // Views
  getViews: (collectionId?: string) =>
    apiGet<unknown[]>('/metadata/views', collectionId ? { collectionId } : undefined),
  getView: (id: string) => apiGet<unknown>(`/metadata/views/${id}`),
  createView: (data: unknown) => apiPost<unknown>('/metadata/views', data),
  updateView: (id: string, data: unknown) => apiPatch<unknown>(`/metadata/views/${id}`, data),
  deleteView: (id: string) => apiDelete<void>(`/metadata/views/${id}`),

  // View Columns
  getViewColumns: (viewId: string) => apiGet<unknown[]>(`/metadata/views/${viewId}/columns`),
  updateViewColumns: (viewId: string, columns: unknown[]) =>
    apiPut<unknown>(`/metadata/views/${viewId}/columns`, columns),

  // Form Layouts
  getFormLayouts: (collectionId: string) =>
    apiGet<unknown[]>(`/metadata/views/form-layouts`, { collectionId }),
  getFormLayout: (id: string) => apiGet<unknown>(`/metadata/views/form-layouts/${id}`),
  createFormLayout: (data: unknown) => apiPost<unknown>('/metadata/views/form-layouts', data),
  updateFormLayout: (id: string, data: unknown) =>
    apiPatch<unknown>(`/metadata/views/form-layouts/${id}`, data),
  deleteFormLayout: (id: string) => apiDelete<void>(`/metadata/views/form-layouts/${id}`),

  // Saved Filters
  getSavedFilters: (collectionId: string) =>
    apiGet<unknown[]>(`/metadata/views/saved-filters`, { collectionId }),
  createSavedFilter: (data: unknown) => apiPost<unknown>('/metadata/views/saved-filters', data),
  deleteSavedFilter: (id: string) => apiDelete<void>(`/metadata/views/saved-filters/${id}`),
};

// Data API endpoints
export const dataApi = {
  // Collection Data
  list: (collectionCode: string, params?: Record<string, unknown>) =>
    apiGet<{ data: unknown[]; total: number; page: number; pageSize: number }>(
      `/collections/${collectionCode}/data`,
      params as Record<string, string | number | boolean | undefined>
    ),
  getOne: (collectionCode: string, id: string) =>
    apiGet<unknown>(`/collections/${collectionCode}/data/${id}`),
  create: (collectionCode: string, data: unknown) =>
    apiPost<unknown>(`/collections/${collectionCode}/data`, data),
  update: (collectionCode: string, id: string, data: unknown) =>
    apiPatch<unknown>(`/collections/${collectionCode}/data/${id}`, data),
  delete: (collectionCode: string, id: string) =>
    apiDelete<void>(`/collections/${collectionCode}/data/${id}`),

  // Bulk Operations
  bulkUpdate: (collectionCode: string, ids: string[], data: unknown) =>
    apiPost<{ updated: number }>(`/collections/${collectionCode}/data/bulk-update`, { ids, data }),
  bulkDelete: (collectionCode: string, ids: string[]) =>
    apiPost<{ deleted: number }>(`/collections/${collectionCode}/data/bulk-delete`, { ids }),

  // Reference Data
  getReferenceOptions: (collectionCode: string, propertyCode: string, query?: string) =>
    apiGet<{ id: string; label: string }[]>(
      `/collections/${collectionCode}/references/${propertyCode}`,
      { q: query }
    ),

  // Schema
  getSchema: (collectionCode: string) =>
    apiGet<unknown>(`/collections/${collectionCode}/schema`),
};

// Combined API object for convenience
export const api = {
  // Core HTTP methods
  get: apiGet,
  post: apiPost,
  put: apiPut,
  patch: apiPatch,
  delete: apiDelete,

  // Spread metadata functions
  ...metadataApi,
  data: dataApi,

  // Collections alias
  collections: {
    list: () => metadataApi.getCollections(),
    get: (id: string) => metadataApi.getCollection(id),
    create: (data: unknown) => metadataApi.createCollection(data),
    update: (id: string, data: unknown) => metadataApi.updateCollection(id, data),
    delete: (id: string) => metadataApi.deleteCollection(id),
  },

  // Properties alias
  properties: {
    list: (collectionId: string) => metadataApi.getProperties(collectionId),
    get: (collectionId: string, propertyId: string) =>
      metadataApi.getProperty(collectionId, propertyId),
    create: (collectionId: string, data: unknown) =>
      metadataApi.createProperty(collectionId, data),
    update: (collectionId: string, propertyId: string, data: unknown) =>
      metadataApi.updateProperty(collectionId, propertyId, data),
    delete: (collectionId: string, propertyId: string) =>
      metadataApi.deleteProperty(collectionId, propertyId),
  },

  // Views alias
  views: {
    list: (collectionId?: string) => metadataApi.getViews(collectionId),
    get: (id: string) => metadataApi.getView(id),
    create: (data: unknown) => metadataApi.createView(data),
    update: (id: string, data: unknown) => metadataApi.updateView(id, data),
    delete: (id: string) => metadataApi.deleteView(id),
    getColumns: (viewId: string) => metadataApi.getViewColumns(viewId),
    updateColumns: (viewId: string, columns: unknown[]) =>
      metadataApi.updateViewColumns(viewId, columns),
  },
};
