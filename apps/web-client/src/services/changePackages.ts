import metadataApi from './metadataApi';

export type ChangePackageStatus = 'open' | 'complete' | 'applied';

export interface MetadataChange {
  kind: 'collection' | 'property' | 'view' | 'form' | 'flow' | 'automation' | 'decision' | 'guidedProcess' | 'workspace';
  code: string;
  beforeHash?: string | null;
  after: Record<string, unknown>;
  source: string;
  capturedAt: string;
}

export interface ChangePackage {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  applicationId: string;
  status: ChangePackageStatus;
  changes: MetadataChange[];
  completedAt?: string | null;
  appliedAt?: string | null;
  sourceInstanceId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePackageDto {
  applicationId: string;
  code: string;
  name: string;
  description?: string;
}

export interface AddArtifactDto {
  kind: MetadataChange['kind'];
  code: string;
}

export interface ImportPackageDto {
  applicationId: string;
  payload: {
    code: string;
    name: string;
    description?: string | null;
    applicationId: string;
    status: ChangePackageStatus;
    changes: MetadataChange[];
    sourceInstanceId?: string | null;
  };
}

export const changePackagesApi = {
  list: async (applicationId?: string, status?: ChangePackageStatus) => {
    const params: Record<string, string> = {};
    if (applicationId) params.applicationId = applicationId;
    if (status) params.status = status;
    const res = await metadataApi.get<{ data: ChangePackage[] }>('/change-packages', { params });
    return res.data?.data ?? [];
  },
  get: async (id: string) => {
    const res = await metadataApi.get<ChangePackage>(`/change-packages/${id}`);
    return res.data;
  },
  create: async (dto: CreatePackageDto) => {
    const res = await metadataApi.post<ChangePackage>('/change-packages', dto);
    return res.data;
  },
  addArtifact: async (id: string, dto: AddArtifactDto) => {
    const res = await metadataApi.post<ChangePackage>(`/change-packages/${id}/artifacts`, dto);
    return res.data;
  },
  removeArtifact: async (id: string, kind: MetadataChange['kind'], code: string) => {
    const res = await metadataApi.delete<ChangePackage>(
      `/change-packages/${id}/artifacts/${kind}/${encodeURIComponent(code)}`,
    );
    return res.data;
  },
  complete: async (id: string) => {
    const res = await metadataApi.post<ChangePackage>(`/change-packages/${id}/complete`);
    return res.data;
  },
  exportJson: async (id: string) => {
    const res = await metadataApi.get<unknown>(`/change-packages/${id}/export`);
    return res.data;
  },
  importPackage: async (dto: ImportPackageDto) => {
    const res = await metadataApi.post<ChangePackage>('/change-packages/import', dto);
    return res.data;
  },
};
