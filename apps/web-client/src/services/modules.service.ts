import metadataApi from './metadataApi';

export interface ModuleItem {
  id: string;
  name: string;
  slug: string;
  description?: string;
  route?: string;
  icon?: string;
  category?: string;
  sortOrder: number;
}

export const modulesService = {
  list: async (): Promise<ModuleItem[]> => {
    const res = await metadataApi.get<ModuleItem[]>('/modules');
    return res.data;
  },
};
