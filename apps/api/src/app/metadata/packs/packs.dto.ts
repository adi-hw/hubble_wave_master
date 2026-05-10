export interface PackInstallRequest {
  packCode: string;
  releaseId: string;
  manifest: Record<string, unknown>;
  artifactUrl: string;
}

export interface PackRollbackRequest {
  releaseRecordId?: string;
  packCode?: string;
  releaseId?: string;
}

export interface PackReleaseQuery {
  packCode?: string;
  status?: string;
  limit?: number;
}

export interface PackCatalogInstallRequest {
  packCode: string;
  releaseId: string;
}
