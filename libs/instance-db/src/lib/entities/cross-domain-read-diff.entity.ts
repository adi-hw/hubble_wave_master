import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Phase D shadow-mode diff log (ADR D1a §C migration plan).
 *
 * When a service's read path is being migrated from a direct DB
 * query to a cross-service HTTP call, the migration runs in shadow
 * mode for ~30 days: the legacy DB read is the source of truth, the
 * HTTP read runs in parallel, and any payload mismatch is logged
 * here for operator review.
 *
 * Operators query this table (or a dashboard built on it) to verify
 * 100% agreement before flipping the call site's primary path to
 * HTTP. The plan called this out as the gating signal: "flag flip
 * after 30 consecutive days of zero diffs".
 *
 * Owned by svc-automation initially (the first migration target);
 * other services that adopt the shadow-mode pattern share this
 * table. Lives in the `automation` Postgres schema; sharedEntities
 * graph is unaffected.
 */
@Entity({ name: 'cross_domain_read_diff', schema: 'automation' })
@Index(['callerService', 'callsite', 'detectedAt'])
@Index(['detectedAt'])
@Index(['diffKind'])
export class CrossDomainReadDiff {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Service that observed the diff (e.g., `svc-automation`). */
  @Column({ name: 'caller_service', type: 'varchar', length: 80 })
  callerService!: string;

  /**
   * Stable identifier for the call site, used to filter in
   * dashboards (e.g., `automation-runtime.getCollection`,
   * `record-mutation.getCollectionWithProperties`).
   */
  @Column({ name: 'callsite', type: 'varchar', length: 200 })
  callsite!: string;

  /**
   * The lookup key whose two reads diverged (e.g., the collection
   * code or UUID). Length capped because we don't want operator
   * tooling to return paragraphs of arbitrary text.
   */
  @Column({ name: 'lookup_key', type: 'varchar', length: 500 })
  lookupKey!: string;

  /**
   * Classification:
   *   - `value-mismatch` — both paths returned a value but the
   *     payloads differ field-by-field.
   *   - `db-only`        — DB returned a result; HTTP returned null
   *     (or the resource was filtered by user-context authz).
   *   - `http-only`      — HTTP returned a result; DB returned null.
   *     (Pathological — should never happen if the HTTP path is a
   *     faithful mirror.)
   *   - `http-error`     — DB succeeded; HTTP threw. The `httpError`
   *     column carries the failure detail.
   */
  @Column({ name: 'diff_kind', type: 'varchar', length: 50 })
  diffKind!:
    | 'value-mismatch'
    | 'db-only'
    | 'http-only'
    | 'http-error';

  /**
   * Structured field-level diff (only for `value-mismatch`):
   *
   *   {
   *     "differingFields": [
   *       { "path": "name", "db": "Work Order", "http": "Work Orders" },
   *       ...
   *     ],
   *     "dbOnlyFields": ["legacyField"],
   *     "httpOnlyFields": ["newField"]
   *   }
   *
   * Per ADR D1a §C: "log only the delta (which fields differ, with
   * old + new values)". We do NOT log the full payloads — those
   * would be redundant with the source records and bloat the
   * table.
   */
  @Column({ name: 'delta', type: 'jsonb', nullable: true })
  delta!: Record<string, unknown> | null;

  /**
   * Populated only when `diffKind = 'http-error'`. The error
   * message is captured for diagnostics; the stack trace is NOT
   * stored here (it leaks internal detail and bloats the table).
   * Operators investigating a sustained spike pivot to logs/traces
   * via the `detectedAt` timestamp + `callsite`.
   */
  @Column({ name: 'http_error', type: 'text', nullable: true })
  httpError!: string | null;

  @CreateDateColumn({ name: 'detected_at', type: 'timestamptz' })
  detectedAt!: Date;
}
