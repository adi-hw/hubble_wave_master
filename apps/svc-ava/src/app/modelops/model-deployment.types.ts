export type ModelDeploymentRequest = {
  modelArtifactId: string;
  targetType: string;
  targetConfig?: Record<string, unknown>;
  approverIds?: string[];
  metadata?: Record<string, unknown>;
};

export type ModelDeploymentUpdate = {
  targetType?: string;
  targetConfig?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};
