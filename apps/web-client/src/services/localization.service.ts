import { createApiClient } from './api';

export type LocalizationBundle = {
  locale: {
    code: string;
    name: string;
    direction: string;
  };
  entries: Record<string, Record<string, string>>;
  checksum: string;
  publishedAt?: string | null;
};

const METADATA_API_URL = import.meta.env.VITE_METADATA_API_URL ?? '/api/metadata';
const api = createApiClient(METADATA_API_URL);

export const localizationService = {
  async getBundle(localeCode: string): Promise<LocalizationBundle> {
    const res = await api.get<LocalizationBundle>(`/localization/bundles/${localeCode}`);
    return res.data;
  },
};
