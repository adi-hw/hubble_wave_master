import type { DecisionProvenance } from './provenance';

/**
 * Port for emitting an audit row when an admin bypass short-circuits an
 * authorization check (canon §10: every action explainable, including by
 * whom and under which permission), or when a security event fires that
 * does not fit the admin-bypass shape — refresh-token reuse detection
 * (canon §29.5), future credential-stuffing detection, MFA tamper
 * attempts, etc.
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

  /**
   * Emit a high-severity security event that is NOT an authorization
   * short-circuit — e.g. refresh-token reuse detected (canon §29.5),
   * service-token replay, etc. Persisted to the same `AccessAuditLog`
   * surface as `logAdminBypass` so operators have a single forensic
   * stream to query.
   *
   * Plaintext IP / User-Agent SHOULD flow in `context` here (the
   * operational refresh_tokens table stores only hashes per
   * canon §29.5). The audit log row has different retention and
   * access controls.
   *
   * The adapter writes `decision = 'HIGH_SEVERITY'` so a SIEM query
   * filtering on that value surfaces every event of this kind.
   */
  logSecurityEvent(event: SecurityAuditEvent): void;
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

/**
 * Closed vocabulary for `SecurityAuditEvent.kind`. Adding a new value is
 * a deliberate cross-team decision — SIEM filters and dashboards key on
 * these strings.
 */
export type SecurityAuditEventKind =
  | 'reuse_detected'      // canon §29.5 refresh-token reuse
  | 'logout_all_devices'  // canon §29.6.1 global kill-switch invoked
  | 'service_replay'      // future: service-to-service token replay
  | 'mfa_tamper';         // future: MFA secret tamper detection

/** Triage severity. */
export type SecurityAuditSeverity = 'low' | 'medium' | 'high';

export interface SecurityAuditEvent {
  /**
   * The user whose credential surface fired the event. NOT the bystander
   * who may have been served the bland 401 — that distinction is
   * deliberate: a stolen-token reuse case attributes to the legitimate
   * user, who needs the audit row in their security history.
   */
  userId: string;
  /** Closed vocabulary; see `SecurityAuditEventKind`. */
  kind: SecurityAuditEventKind;
  severity: SecurityAuditSeverity;
  /**
   * Free-form forensic payload. For `kind === 'reuse_detected'`:
   *   - `familyId`        — string
   *   - `sessionId`       — string
   *   - `ipAddressAtReuse`— string (plaintext; audit log retention only)
   *   - `userAgentAtReuse`— string (plaintext; audit log retention only)
   */
  context?: Record<string, unknown>;
}

/** Nest DI token for binding the port implementation. */
export const ACCESS_AUDIT_PORT = 'ACCESS_AUDIT_PORT';
