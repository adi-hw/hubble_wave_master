export { AuditModule } from './audit.module';

// Re-export from libs/instance-db so apps/api consumers see one audit barrel.
export { RuntimeAnomalyService } from '@hubblewave/instance-db';
export type { RuntimeAnomalyEvent } from '@hubblewave/instance-db';
