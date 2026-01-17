import { createApiClient } from './api';
import metadataApi from './metadataApi';

export type SearchExperience = {
  id?: string;
  code: string;
  name: string;
  description?: string | null;
  scope: 'system' | 'instance' | 'role' | 'group' | 'personal';
  scopeKey?: string | null;
  config?: Record<string, unknown>;
  isActive?: boolean;
};

export type SearchSource = {
  id?: string;
  code: string;
  name: string;
  description?: string | null;
  collectionCode: string;
  config?: Record<string, unknown>;
  isActive?: boolean;
};

export type SearchDictionary = {
  id?: string;
  code: string;
  name: string;
  locale?: string;
  entries?: Array<{ term: string; synonyms: string[] }>;
  isActive?: boolean;
};

export type SearchIndexState = {
  id: string;
  collectionCode: string;
  status: 'idle' | 'running' | 'failed' | 'paused';
  lastIndexedAt?: string | null;
  lastCursor?: string | null;
  stats?: Record<string, unknown>;
  updatedAt?: string;
};

const SEARCH_API_URL = import.meta.env.VITE_SEARCH_API_URL ?? '/api/search';
const searchApi = createApiClient(SEARCH_API_URL);

export async function listSearchExperiences(): Promise<SearchExperience[]> {
  const response = await metadataApi.get('/metadata/search/experiences');
  return Array.isArray(response.data) ? (response.data as SearchExperience[]) : [];
}

export async function createSearchExperience(payload: {
  code: string;
  name: string;
  description?: string | null;
  scope: SearchExperience['scope'];
  scopeKey?: string | null;
  config?: Record<string, unknown>;
}) {
  const response = await metadataApi.post('/metadata/search/experiences', {
    code: payload.code,
    name: payload.name,
    description: payload.description,
    scope: payload.scope,
    scope_key: payload.scopeKey ?? undefined,
    config: payload.config,
  });
  return response.data as SearchExperience;
}

export async function updateSearchExperience(
  code: string,
  payload: Partial<Omit<SearchExperience, 'code' | 'id'>>,
) {
  const response = await metadataApi.put(`/metadata/search/experiences/${code}`, {
    name: payload.name,
    description: payload.description,
    scope: payload.scope,
    scope_key: payload.scopeKey,
    config: payload.config,
  });
  return response.data as SearchExperience;
}

export async function listSearchSources(): Promise<SearchSource[]> {
  const response = await metadataApi.get('/metadata/search/sources');
  return Array.isArray(response.data) ? (response.data as SearchSource[]) : [];
}

export async function createSearchSource(payload: {
  code: string;
  name: string;
  description?: string | null;
  collectionCode: string;
  config?: Record<string, unknown>;
}) {
  const response = await metadataApi.post('/metadata/search/sources', {
    code: payload.code,
    name: payload.name,
    description: payload.description,
    collection_code: payload.collectionCode,
    config: payload.config,
  });
  return response.data as SearchSource;
}

export async function updateSearchSource(
  code: string,
  payload: Partial<Omit<SearchSource, 'code' | 'id'>>,
) {
  const response = await metadataApi.put(`/metadata/search/sources/${code}`, {
    name: payload.name,
    description: payload.description,
    collection_code: payload.collectionCode,
    config: payload.config,
  });
  return response.data as SearchSource;
}

export async function listSearchDictionaries(): Promise<SearchDictionary[]> {
  const response = await metadataApi.get('/metadata/search/dictionaries');
  return Array.isArray(response.data) ? (response.data as SearchDictionary[]) : [];
}

export async function createSearchDictionary(payload: {
  code: string;
  name: string;
  locale?: string;
  entries?: Array<{ term: string; synonyms: string[] }>;
}) {
  const response = await metadataApi.post('/metadata/search/dictionaries', {
    code: payload.code,
    name: payload.name,
    locale: payload.locale,
    entries: payload.entries,
  });
  return response.data as SearchDictionary;
}

export async function updateSearchDictionary(
  code: string,
  payload: Partial<Omit<SearchDictionary, 'code' | 'id'>>,
) {
  const response = await metadataApi.put(`/metadata/search/dictionaries/${code}`, {
    name: payload.name,
    locale: payload.locale,
    entries: payload.entries,
  });
  return response.data as SearchDictionary;
}

export async function listSearchIndexState(collectionCode?: string): Promise<SearchIndexState[]> {
  const params = collectionCode ? `?collection_code=${encodeURIComponent(collectionCode)}` : '';
  const response = await metadataApi.get(`/metadata/search/index-state${params}`);
  return Array.isArray(response.data) ? (response.data as SearchIndexState[]) : [];
}

export async function reindexSearch(payload: {
  sourceCodes?: string[];
  collectionCodes?: string[];
  batchSize?: number;
}) {
  const response = await searchApi.post('/reindex', payload);
  return response.data as { queued: number; sources: number; collections: number };
}
