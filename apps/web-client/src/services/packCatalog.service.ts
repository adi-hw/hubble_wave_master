import { createApiClient } from './api';

const METADATA_API_URL = import.meta.env.VITE_METADATA_API_URL ?? '/api/metadata';
const api = createApiClient(METADATA_API_URL);

export type PackCatalogItem = {
  pack: {
    code: string;
    name: string;
    description?: string | null;
    publisher?: string;
    license?: string | null;
  };
  release: {
    releaseId: string;
    manifestRevision: number;
    compatibility?: Record<string, unknown> | null;
    assets?: Record<string, unknown> | null;
    isInstallableByClient: boolean;
  };
};

export async function listPackCatalog(): Promise<PackCatalogItem[]> {
  const response = await api.get('/packs/catalog');
  const payload = response.data;
  return Array.isArray(payload) ? (payload as PackCatalogItem[]) : [];
}

export async function installPackFromCatalog(packCode: string, releaseId: string) {
  return api.post('/packs/catalog/install', { packCode, releaseId });
}
