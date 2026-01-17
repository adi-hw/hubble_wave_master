import { ModelEvaluationStatus } from '@hubblewave/instance-db';

export type ModelEvaluationRequest = {
  datasetSnapshotId?: string;
  metrics?: Record<string, unknown>;
  confusionMatrix?: Record<string, unknown>;
  calibrationStats?: Record<string, unknown>;
  status?: ModelEvaluationStatus;
  metadata?: Record<string, unknown>;
};

export type ModelEvaluationUpdate = {
  metrics?: Record<string, unknown>;
  confusionMatrix?: Record<string, unknown>;
  calibrationStats?: Record<string, unknown>;
  status?: ModelEvaluationStatus;
  metadata?: Record<string, unknown>;
};
