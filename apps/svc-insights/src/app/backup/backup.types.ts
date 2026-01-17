export type BackupArtifact = {
  key: string;
  checksum: string;
  sizeBytes: number;
  contentType: string;
};

export type BackupSummary = {
  backupId: string;
  startedAt: string;
  completedAt: string;
  postgres: BackupArtifact;
  typesense: BackupArtifact[];
  manifest: BackupArtifact;
};

export type RestoreSummary = {
  backupId: string;
  startedAt: string;
  completedAt: string;
  postgres: BackupArtifact;
  typesense: BackupArtifact[];
  manifest: BackupArtifact;
  validation: {
    postgresOk: boolean;
    typesenseOk: boolean;
  };
};
