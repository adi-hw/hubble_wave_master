import { DatasetDefinitionStatus, DatasetSnapshotStatus } from '@hubblewave/instance-db';

export type DatasetDefinitionRequest = {
  code: string;
  name: string;
  description?: string;
  sourceCollectionCode: string;
  filter?: Record<string, unknown>;
  labelMapping?: Record<string, unknown>;
  featureMapping?: Record<string, unknown>;
  status?: DatasetDefinitionStatus;
  metadata?: Record<string, unknown>;
};

export type DatasetDefinitionUpdate = Partial<Omit<DatasetDefinitionRequest, 'code'>>;

export type DatasetSnapshotSummary = {
  id: string;
  datasetDefinitionId: string;
  status: DatasetSnapshotStatus;
  snapshotUri?: string | null;
  rowCount?: number | null;
  checksum?: string | null;
  requestedBy?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
};
