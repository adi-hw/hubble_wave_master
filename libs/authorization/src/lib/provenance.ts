/**
 * Canon §28.7 — decision provenance.
 *
 * Every authorization decision MUST be able to produce its provenance on
 * request: which level fired, which rule matched, which principal triggered
 * the match, and the fallback chain of levels checked before the match.
 *
 * The shape committed to in canon §28.7:
 * ```json
 * {
 *   "effect": "allow" | "deny",
 *   "matchedLevel": 1-7,
 *   "matchedRuleId": "<uuid>" | null,
 *   "matchedPrincipal": "<role-uuid> | <user-uuid> | <group-uuid>" | null,
 *   "fallbackChain": ["level-1: no match", "level-2: allow matched (rule: <uuid>)"]
 * }
 * ```
 *
 * Provenance is attached to F021 audit log rows (in
 * `AccessAuditLog.context.additionalData.provenance`) and exposed via the
 * `/authorization/explain` admin endpoint.
 */

/** Final effect of a non-field decision (collection / record). */
export type DecisionEffect = 'allow' | 'deny';

/**
 * Generic provenance shape covering collection and record decisions.
 * Field-level decisions extend this with masking severity (see
 * `FieldDecisionProvenance`) because §28.5 produces ALLOW + masking strategy
 * rather than a binary DENY.
 */
export interface DecisionProvenance {
  /**
   * Final effect after evaluating §28.2 (field) / §28.3 (collection)
   * precedence.
   */
  effect: DecisionEffect;

  /**
   * The level (1-3 for collection/record, 1-7 for fields) where the
   * decision crystallized.
   *
   * Collection levels (§28.3):
   *   1 — `deny` collection rule matched principal + operation
   *   2 — `allow` collection rule matched principal + operation
   *   3 — no rule matched (default deny per §28.4)
   *
   * Field levels (§28.2):
   *   1 — explicit field-rule deny matched
   *   2 — explicit field-rule allow matched
   *   3 — wildcard field-rule deny matched
   *   4 — wildcard field-rule allow matched
   *   5 — collection-rule deny (placeholder — not fired by the field
   *       evaluator today; reserved for §28 future work)
   *   6 — collection-rule allow (placeholder)
   *   7 — no rule matched; `secureFieldsByDefault` decides
   */
  matchedLevel: number;

  /**
   * UUID of the rule that triggered the match. `null` when the decision
   * came from a rule-less mechanism (level 3 default deny, level 7 default
   * deny/allow) or when an admin bypass produced the would-be provenance
   * shape (matchedLevel 0).
   */
  matchedRuleId: string | null;

  /**
   * Principal identifier on the matched rule (`roleId`, `userId`, or
   * `groupId`). `null` when the rule applied to "everyone" (all principal
   * columns NULL) or when no rule matched.
   */
  matchedPrincipal: string | null;

  /**
   * Ordered audit trail of every level that was checked.
   *
   * Each entry is shaped `"level-N: <outcome>"` where `<outcome>` is one of:
   *   - `"no match"`
   *   - `"allow matched (rule: <uuid>)"`
   *   - `"deny matched (rule: <uuid>)"`
   *   - `"default deny"` (no rule reached, secure default applied)
   *   - `"default deny (secureFieldsByDefault=true)"` (field level 7)
   *   - `"default allow (legacy default; F005-pending)"` (field level 7
   *      with the flag off)
   */
  fallbackChain: string[];
}

/**
 * Effect for a field decision. `mask` distinguishes "the allow rule
 * matched but produced a PARTIAL or FULL masking strategy" from a binary
 * allow/deny. Useful for downstream UI ("redacted" vs "denied") and for
 * compliance reporting.
 */
export type FieldDecisionEffect = 'allow' | 'deny' | 'mask';

/**
 * Field-level decision provenance. Carries masking strategy alongside the
 * canonical provenance fields. `effect` follows the rules:
 *   - `'allow'` when the matched allow rule produced `maskingStrategy === 'NONE'`
 *   - `'mask'` when the matched allow rule produced `'PARTIAL'`
 *   - `'deny'` when either an explicit deny matched, the wildcard deny
 *      matched, or §28.5 most-restrictive masking landed on `'FULL'`
 *
 * `maskingStrategy` mirrors the value returned in `AuthorizedPropertyMeta`
 * so the explain endpoint surfaces the exact same mask the runtime applies.
 */
export interface FieldDecisionProvenance extends Omit<DecisionProvenance, 'effect'> {
  effect: FieldDecisionEffect;
  /**
   * Final masking strategy applied to the field, after §28.5
   * MOST-restrictive combination across matching allow rules.
   *
   *   - `'NONE'` when the user can read the unmasked value (effect: 'allow')
   *   - `'PARTIAL'` when the user sees a partial mask (effect: 'mask')
   *   - `'FULL'` when the field is fully redacted (effect: 'deny')
   */
  maskingStrategy: 'NONE' | 'PARTIAL' | 'FULL';
}
