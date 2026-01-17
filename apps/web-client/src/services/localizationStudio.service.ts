import { createApiClient } from './api';

export type StudioLocale = {
  id: string;
  code: string;
  name: string;
  direction: string;
  isActive: boolean;
  updatedAt: string;
};

export type StudioKey = {
  id: string;
  namespace: string;
  key: string;
  defaultText: string;
  description?: string | null;
};

export type StudioValue = {
  keyId: string;
  valueId: string | null;
  namespace: string;
  key: string;
  defaultText: string;
  description?: string | null;
  text: string;
  status: 'draft' | 'approved' | 'published';
  updatedAt?: string | null;
};

export type TranslationRequest = {
  id: string;
  status: string;
  locale: string;
  namespace: string;
  key: string;
  reviewerIds: string[];
  dueAt?: string | null;
  workflowInstanceId?: string | null;
  requestedBy?: string | null;
  createdAt: string;
};

const METADATA_API_URL = import.meta.env.VITE_METADATA_API_URL ?? '/api/metadata';
const api = createApiClient(METADATA_API_URL);

export async function listLocales(): Promise<StudioLocale[]> {
  const response = await api.get('/localization/locales');
  return Array.isArray(response.data) ? (response.data as StudioLocale[]) : [];
}

export async function listKeys(namespace?: string): Promise<StudioKey[]> {
  const query = namespace ? `?namespace=${encodeURIComponent(namespace)}` : '';
  const response = await api.get(`/localization/keys${query}`);
  return Array.isArray(response.data) ? (response.data as StudioKey[]) : [];
}

export async function listValues(localeCode: string, namespace?: string): Promise<StudioValue[]> {
  const params = new URLSearchParams({ locale_code: localeCode });
  if (namespace) params.set('namespace', namespace);
  const response = await api.get(`/localization/values?${params.toString()}`);
  return Array.isArray(response.data) ? (response.data as StudioValue[]) : [];
}

export async function upsertValue(payload: {
  locale_code: string;
  namespace: string;
  key: string;
  text: string;
  status?: StudioValue['status'];
}): Promise<StudioValue> {
  const response = await api.post('/localization/values', payload);
  return response.data as StudioValue;
}

export async function updateValue(
  id: string,
  payload: {
    text?: string;
    status?: StudioValue['status'];
  },
): Promise<StudioValue> {
  const response = await api.patch(`/localization/values/${encodeURIComponent(id)}`, payload);
  return response.data as StudioValue;
}

export async function listTranslationRequests(status?: string): Promise<TranslationRequest[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  const response = await api.get(`/localization/requests${query}`);
  return Array.isArray(response.data) ? (response.data as TranslationRequest[]) : [];
}

export async function cancelTranslationRequest(id: string): Promise<TranslationRequest> {
  const response = await api.patch(`/localization/requests/${encodeURIComponent(id)}`, {
    status: 'cancelled',
  });
  return response.data as TranslationRequest;
}

export async function publishBundles(localeCodes: string[]): Promise<void> {
  await api.post('/localization/publish', { locale_codes: localeCodes });
}
