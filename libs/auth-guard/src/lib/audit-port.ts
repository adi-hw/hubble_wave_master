/**
 * Port for emitting an audit row when an authorization decision needs
 * forensic attribution (canon §10: every action explainable, including
 * by whom and under which permission). Three call shapes today:
 *
 *   1. `logAdminBypass` — historical residue from the F021 admin-bypass
 *      forensic surface; Plan Fix 33 retired the silent admin bypass
 *      from `AuthorizationService` and the search query service (canon
 *      §28.6). The method is retained on the port for future callers
 *      that want to record an explicit "policy would have denied"
 *      shape; nothing in production calls it today.
 *
 *   2. `logSecurityEvent` — refresh-token reuse detection (canon §29.5),
 *      `logout-all-devices` (canon §29.6.1), MFA tamper, service-token
 *      replay. Persisted to `AccessAuditLog` with
 *      `decision = 'HIGH_SEVERITY'`.
 *
 *   3. `logAccessDenied` — W2 Stream 2 PR6. Called by the
 *      `PermissionsGuard` + `CollectionAccessGuard` whenever a 403
 *      fires at a controller boundary. Captures the deny provenance
 *      (which guard / which capability / which collection) so
 *      operators answering "why did user X get 403 on route Y" have
 *      a forensic trail. Persisted to the same `AccessAuditLog`
 *      surface so compliance can query a single stream.
 *
 * Port location (W2 Stream 2 PR6): moved from
 * `libs/authorization/src/lib/audit-port.ts` to
 * `libs/auth-guard/src/lib/audit-port.ts`. Reason: the auth-guard
 * library cannot import from `libs/authorization` without creating a
 * dependency cycle (authorization already imports
 * `UserRequestContext` from auth-guard), but the guards
 * (`PermissionsGuard` + `CollectionAccessGuard`) need to call the port
 * on 403. Moving the port to auth-guard breaks the cycle. The
 * `libs/authorization` evaluator continues to consume the port via the
 * `@hubblewave/auth-guard` re-export — the wiring is symmetric.
 *
 * Implementations MUST handle write failures internally (best-effort
 * persistence). Callers wrap every invocation in try/catch so a
 * throwing port cannot regress runtime correctness.
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

  /**
   * Emit an audit row for a 403 produced by the guard chain. The
   * `provenance` payload mirrors the §28.7 shape (`effect`,
   * `matchedLevel`, `matchedRuleId`, `matchedPrincipal`,
   * `fallbackChain`) so admin tooling — and `/authorization/explain`
   * — can answer "why did the user get 403" from the audit log
   * directly. Stored in `AccessAuditLog.context.additionalData.authzProvenance`.
   *
   * Best-effort: implementations MUST swallow write failures (the
   * caller's 403 is the authoritative response; failing to record an
   * audit row must not turn into a 500 for the user).
   *
   * Resource identifier vocabulary:
   *   - `kind: 'route'`     — handler-level deny (PermissionsGuard);
   *                           `identifier` is the controller class +
   *                           method name, e.g. `UsersController.update`.
   *   - `kind: 'collection'`— collection-level deny
   *                           (CollectionAccessGuard); `identifier` is
   *                           the collection UUID.
   *   - `kind: 'field'`     — field-level deny (future caller from
   *                           libs/authorization's field evaluator).
   */
  logAccessDenied(event: AccessDeniedEvent): void;
}

/**
 * Minimal subset of the §28.7 `DecisionProvenance` shape needed by the
 * port. Kept local so auth-guard does not depend on libs/authorization.
 * Field-decision callers narrow further via the `maskingStrategy`
 * field; collection / route decisions use this base shape.
 *
 * The full canonical shape lives at
 * `libs/authorization/src/lib/provenance.ts:DecisionProvenance` — the
 * two are intentionally compatible by assignment.
 */
export interface AuditedDecisionProvenance {
  effect: 'allow' | 'deny' | 'mask';
  matchedLevel: number;
  matchedRuleId: string | null;
  matchedPrincipal: string | null;
  fallbackChain: string[];
  /** Optional masking strategy for field-level decisions. */
  maskingStrategy?: 'NONE' | 'PARTIAL' | 'FULL';
}

export interface AccessDeniedEvent {
  /** User who received the 403. From `UserRequestContext.userId`. */
  userId: string;
  /**
   * Resource the user attempted to access. `kind` discriminates how
   * `identifier` is interpreted; see `logAccessDenied` docstring.
   */
  resource: {
    kind: 'route' | 'collection' | 'field';
    identifier: string;
  };
  /**
   * §28.7 provenance payload for the deny decision. Captured by the
   * guard (PermissionsGuard or CollectionAccessGuard) at the moment
   * of throw so the audit row carries the same reasoning the
   * `/authorization/explain` endpoint would produce on demand.
   */
  provenance: AuditedDecisionProvenance;
  /**
   * Optional structured context. The adapter writes the full object
   * into `AccessAuditLog.context.additionalData.requestContext`.
   * Reserved keys:
   *   - `requiredCode` — string. The `@RequirePermission(code)` the
   *      guard checked but the user did not have. Used in operator
   *      forensics; NEVER returned to the client (canon §28 bland
   *      403 contract).
   *   - `httpMethod` — string. The HTTP verb of the request.
   *   - `httpPath`   — string. The route pattern (NOT the raw URL —
   *      includes path parameter names).
   */
  requestContext?: Record<string, unknown>;
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
   *   - `wouldBeProvenance` — `AuditedDecisionProvenance`, §28.7
   *      forensic shape describing the decision the evaluator would have
   *      produced had the admin bypass not fired. Useful for compliance
   *      reviews answering "what would the policy have decided?".
   *      Retained on the port even though Plan Fix 33 retired the silent
   *      admin bypass from `AuthorizationService` — future bypass paths
   *      (e.g. break-glass admin overrides) would consume it.
   * Any additional keys are passed through to
   * `AccessAuditLog.context.additionalData` for caller-defined forensics.
   */
  context?: Record<string, unknown> & {
    wouldBeProvenance?: AuditedDecisionProvenance;
  };
}

/**
 * Closed vocabulary for `SecurityAuditEvent.kind`. Adding a new value is
 * a deliberate cross-team decision — SIEM filters and dashboards key on
 * these strings.
 */
export type SecurityAuditEventKind =
  | 'reuse_detected'              // canon §29.5 refresh-token reuse
  | 'logout_all_devices'          // canon §29.6.1 global kill-switch invoked
  | 'service_replay'              // future: service-to-service token replay
  | 'mfa_tamper'                  // future: MFA secret tamper detection
  | 'handler_missing_boundary';   // W2 Stream 3 PR-final: route reached
                                  // PermissionsGuard with no primary boundary
                                  // (the AST scanner should have caught it at
                                  // PR time; this is the runtime defense)

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
