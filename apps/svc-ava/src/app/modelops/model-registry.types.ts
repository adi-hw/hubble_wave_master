import { ModelArtifactStatus } from '@hubblewave/instance-db';

export type ModelArtifactRequest = {
  code: string;
  name: string;
  version: string;
  description?: string;
  datasetSnapshotId?: string;
  filename?: string;
  contentType?: string;
  metadata?: Record<string, unknown>;
};

export type ModelArtifactUpdate = {
  name?: string;
  description?: string;
  status?: ModelArtifactStatus;
  metadata?: Record<string, unknown>;
};

export type ModelArtifactRegister = {
  checksum: string;
  sizeBytes?: number;
  contentType?: string;
};
