export type ModelTrainingRequest = {
  datasetSnapshotId: string;
  modelCode: string;
  modelName: string;
  modelVersion: string;
  algorithm: string;
  hyperparameters?: Record<string, unknown>;
  trainingConfig?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type ModelTrainingSummary = {
  id: string;
  datasetSnapshotId: string;
  modelCode: string;
  modelName: string;
  modelVersion: string;
  algorithm: string;
  status: string;
  modelArtifactId?: string | null;
  requestedBy?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
};
