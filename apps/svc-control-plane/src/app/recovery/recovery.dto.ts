export interface BackupTriggerDto {
  instanceId: string;
}

export interface RestoreTriggerDto {
  instanceId: string;
  backupId: string;
}
