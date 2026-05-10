export { DbModule } from './db.module';

// Re-export the audit transaction helper from libs/instance-db. This is the
// canonical home of `withAudit`; re-exporting from db keeps apps/api consumers
// pointing at one location regardless of where the canonical implementation
// lives.
export { withAudit } from '@hubblewave/instance-db';
export type { AuditEvent, AuditRecorder } from '@hubblewave/instance-db';
