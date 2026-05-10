import { Global, Module } from '@nestjs/common';
import { RuntimeAnomalyModule } from '@hubblewave/instance-db';

/**
 * AuditModule provides:
 * - Runtime anomaly tracking via `RuntimeAnomalyService` (re-exported from
 *   `@hubblewave/instance-db`'s `RuntimeAnomalyModule`).
 *
 * Audit log WRITES are handled automatically by:
 * - The `withAudit(dataSource, fn)` helper (re-exported from db module)
 * - The `AuditLogSubscriber` TypeORM subscriber (wired by `InstanceDbModule`,
 *   which DbModule re-exports)
 *
 * Both fire inside the same database transaction as the originating action,
 * preserving canon §10's "every action must be explainable" guarantee
 * (W1.6 + W2.D + W3.C enforcement).
 *
 * Audit READ controllers (audit-events.controller.ts, audit-logs.controller.ts)
 * currently live in apps/svc-identity/src/app/audit/. They migrate when the
 * identity module migrates; the foundation slice covers only the service side.
 *
 * @Global so consumers can inject `RuntimeAnomalyService` without explicit
 * AuditModule imports.
 */
@Global()
@Module({
  imports: [RuntimeAnomalyModule],
  exports: [RuntimeAnomalyModule],
})
export class AuditModule {}
