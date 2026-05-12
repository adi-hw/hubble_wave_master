import type { DecisionProvenance } from './provenance';

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
  /**
   * Optional structured context. Reserved keys recognised by the canonical
   * adapter:
   *   - `recordId` — string|null, record-level bypass attribution.
   *   - `wouldBeProvenance` — `DecisionProvenance`, §28.7 forensic shape
   *      describing the decision the evaluator would have produced had the
   *      admin bypass not fired. Useful for compliance reviews answering
   *      "what would the policy have decided?". Removed when canon §28.6
   *      retires the silent admin bypass.
   * Any additional keys are passed through to
   * `AccessAuditLog.context.additionalData` for caller-defined forensics.
   */
  context?: Record<string, unknown> & {
    wouldBeProvenance?: DecisionProvenance;
  };
}

/** Nest DI token for binding the port implementation. */
export const ACCESS_AUDIT_PORT = 'ACCESS_AUDIT_PORT';
