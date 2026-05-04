// Instance Database Library
// Customer instance database - each customer has their own isolated database

export * from './lib/entities/index';
export * from './lib/utils';
export * from './lib/audit-log-hash';
export { withAudit } from './lib/audit/with-audit';
export type { AuditEvent, AuditRecorder } from './lib/audit/with-audit';
export { InstanceDbModule } from './lib/instance-db.module';
export { InstanceDbService, TenantDbService } from './lib/instance-db.service';
