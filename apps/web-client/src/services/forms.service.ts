import metadataApi from './metadataApi';

export interface FormVersion {
  id: string;
  version: number;
  status: 'draft' | 'published';
  schema: any;
  createdAt: string;
  createdBy?: string;
}

export interface FormDefinition {
  id: string;
  name: string;
  slug: string;
  description?: string;
  currentVersion: number;
  versions?: FormVersion[];
}

export const formsService = {
  list: async (): Promise<FormDefinition[]> => {
    const res = await metadataApi.get<FormDefinition[]>('/forms');
    return res.data;
  },
  get: async (id: string): Promise<FormDefinition> => {
    const res = await metadataApi.get<FormDefinition>(`/forms/${id}`);
    return res.data;
  },
  create: async (body: { name: string; slug: string; description?: string; schema?: any }) => {
    const res = await metadataApi.post<FormDefinition>('/forms', body);
    return res.data;
  },
  publish: async (id: string, schema: any) => {
    const res = await metadataApi.post<FormDefinition>(`/forms/${id}/publish`, { schema });
    return res.data;
  },
};
