/**
 * Port for emitting an audit row when an admin bypass short-circuits an
 * authorization check (canon §10: every action explainable, including by
 * whom and under which permission).
 *
 * `libs/authorization` defines the port; the consuming Nest app
 * (apps/api) supplies the implementation via DI. When the port is
 * unbound, the lib falls back to silent bypass — preserves the
 * "lib usable outside apps/api" property for unit tests.
 *
 * Implementations MUST handle write failures internally (best-effort
 * persistence). The lib wraps every call in try/catch as belt-and-
 * suspenders so a throwing port cannot regress runtime correctness.
 */
export interface AccessAuditPort {
  logAdminBypass(event: AccessAuditEvent): void;
}

export interface AccessAuditEvent {
  /** Admin's user ID (from RequestContext.userId). */
  userId: string;
  /** Resource identifier — collectionId UUID, table name, or 'record'. */
  resource: string;
  /**
   * Logical action — bare CRUD ('read'/'create'/'update'/'delete') for
   * collection-level bypasses, or qualified for derivative checks:
   * 'fields:read', 'mask', '<op>:row-filter', '<op>:row-clause'.
   */
  action: string;
  /** Optional structured context (e.g. `{ recordId }` for record-level bypass). */
  context?: Record<string, unknown>;
}

/** Nest DI token for binding the port implementation. */
export const ACCESS_AUDIT_PORT = 'ACCESS_AUDIT_PORT';
