# Platform W2 — F003 Fix: Multi-rule predicate OR semantics

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Fix [F003](../PLATFORM-ROADMAP.md#phase-2--w2--authorization-correctness): row-level ACL rules currently AND their predicates together when a user matches multiple rules, so a user with two rules ("see own records" + "see team records") sees the **intersection** rather than the **union**. Should be OR'd.

**Architecture:** The fix is in `libs/authorization/src/lib/authorization.service.ts::getSafeRowLevelPredicatesForCollection`. Instead of flattening every matched rule's predicates into one array (which the caller then AND-combines via `.andWhere()`), we wrap multi-rule cases in a single `kind: 'or'` predicate. The existing `AbacService.renderPredicate` handles the `or` branch correctly (branches OR'd, inner branch AND'd) — no changes needed downstream.

**Tech Stack:** NestJS 11, TypeScript 5.9, TypeORM 0.3 (query builder), Jest.

**Spec reference:** PLATFORM-ROADMAP.md Phase 2 W2; F003 from audit. The audit report flags this as HIPAA/SOC-2 blocker: customer procurement WILL ask "show me a user seeing the records they're entitled to."

**Predecessor:** `arc-w1-complete` (master HEAD post-PR-#12).

**Solo founder, ~half-day of work.** 4 tasks: spec → implementation → integration verification → commit/PR.

---

## What's wrong today

`getSafeRowLevelPredicatesForCollection` (authorization.service.ts:128-166):

```typescript
const predicates: SafePredicate[] = [];
for (const rule of rules) {
  if (!this.checkPrincipalMatch(rule, userContext)) continue;
  if (!this.checkOperationPermission(rule, operation)) continue;
  if (rule.conditions) {
    const rulePredicates = this.extractSafePredicatesFromCondition(rule.conditions, userContext);
    predicates.push(...rulePredicates);  // ← FLATTENS across rules
  }
}
return predicates;
```

Caller pattern (e.g., apps/api/src/app/data/data.service.ts:148):

```typescript
const { clauses: rlsClauses, params: rlsParams } = await this.authz.buildCollectionRowLevelClause(...);
rlsClauses.forEach((clause) => countQb.andWhere(clause));  // ← AND-combines all clauses
```

Each rule's `conditions` translates to one or more `clauses` entries. With multiple rules matched, the caller AND's them all together. A user matching:
- Rule A: `WHERE owner_id = :userId` (sees own records)
- Rule B: `WHERE team_id IN (:teamIds)` (sees team records)

sees ONLY `WHERE owner_id = :userId AND team_id IN (:teamIds)` — the intersection. Should be OR.

## What right looks like

```sql
-- Wrong (today):
SELECT * FROM records t WHERE t."owner_id" = :userId AND t."team_id" IN (:teamIds)

-- Right (after F003):
SELECT * FROM records t WHERE (t."owner_id" = :userId OR t."team_id" IN (:teamIds))
```

Plus: a rule with NO conditions (unconditional grant) should clear the row-level restriction entirely — return `[]`.

## Edge cases

| Scenario | Current behavior | Correct behavior |
|---|---|---|
| User matches no rules | Returns `[]` — query returns ALL records (BUG, should be denied at operation level) | Out of scope for F003; `canAccessCollection` is the gate, callers must use it. The PR adds a doc comment clarifying this contract. |
| User matches 1 rule with conditions | Returns rule's predicates flat | UNCHANGED — single rule is the AND case. |
| User matches 2+ rules with conditions | Returns flat array, caller AND's → intersection | Return single `kind: 'or'` predicate with branches[]; renders as `(A) OR (B)`. |
| User matches a rule with no conditions | Pushes nothing, may still have other rules → still AND'd | Early return `[]` — unconditional grant trumps any other rule's restriction. |
| Admin user | Returns `[]` (bypass) | UNCHANGED. |
| No collectionAclRepo wired | Returns `[]` | UNCHANGED. |

---

## Task 1: Add failing tests for the multi-rule OR semantic

**Files:**
- Modify: `libs/authorization/src/lib/authorization.service.spec.ts`

- [ ] **Step 1: Write the new test block at the end of the file**

```typescript
describe('AuthorizationService — multi-rule row-level predicates (F003)', () => {
  function buildSvc(rules: Partial<CollectionAccessRuleData>[]) {
    const collectionAclRepo: CollectionAclRepo = {
      find: jest.fn(async () => rules.map((r, i) => ({
        id: `r${i}`,
        collectionId: 'col-1',
        name: r.name ?? `rule-${i}`,
        roleId: r.roleId ?? 'role-user',
        groupId: null,
        userId: null,
        canRead: true,
        canCreate: false,
        canUpdate: false,
        canDelete: false,
        conditions: r.conditions ?? null,
        priority: r.priority ?? 100,
        isActive: true,
      } as CollectionAccessRuleData))),
    };
    const policyCompiler = new PolicyCompilerService();
    const abac = new AbacService();
    return new AuthorizationService(
      collectionAclRepo,
      null,
      null,
      abac,
      policyCompiler,
      null,
    );
  }

  const ctx = {
    userId: 'u-1',
    roles: ['role-user'],
    isAdmin: false,
    attributes: { userId: 'u-1', roleIds: ['role-user'], groupIds: ['g-1'], teamIds: [], siteIds: [] },
  } as unknown as RequestContext;

  it('returns flat predicates when one rule matches (single-rule AND)', async () => {
    const svc = buildSvc([
      { conditions: { property: 'owner_id', operator: 'equals', value: '@me' } },
    ]);
    const predicates = await svc.getSafeRowLevelPredicatesForCollection(ctx, 'col-1', 'read');
    expect(predicates).toHaveLength(1);
    expect(predicates[0].kind).not.toBe('or');
  });

  it('wraps multi-rule predicates in a single or-branch (F003)', async () => {
    const svc = buildSvc([
      { conditions: { property: 'owner_id', operator: 'equals', value: '@me' } },
      { conditions: { property: 'team_id', operator: 'in', value: '@my_teams' } },
    ]);
    const predicates = await svc.getSafeRowLevelPredicatesForCollection(ctx, 'col-1', 'read');
    expect(predicates).toHaveLength(1);
    expect(predicates[0].kind).toBe('or');
    expect((predicates[0] as Extract<SafePredicate, { kind: 'or' }>).branches).toHaveLength(2);
  });

  it('emits SQL with OR between branches, not AND (F003 end-to-end)', async () => {
    const svc = buildSvc([
      { conditions: { property: 'owner_id', operator: 'equals', value: '@me' } },
      { conditions: { property: 'team_id', operator: 'in', value: '@my_teams' } },
    ]);
    const { clauses } = await svc.buildCollectionRowLevelClause(ctx, 'col-1', 'read', 't');
    expect(clauses).toHaveLength(1);
    expect(clauses[0]).toMatch(/\sOR\s/);
    expect(clauses[0]).not.toMatch(/^\s*\(?[^)]*\sAND\s/);
  });

  it('returns [] when any matched rule grants unconditionally', async () => {
    const svc = buildSvc([
      { conditions: { property: 'owner_id', operator: 'equals', value: '@me' } },
      { conditions: null },  // unconditional grant
    ]);
    const predicates = await svc.getSafeRowLevelPredicatesForCollection(ctx, 'col-1', 'read');
    expect(predicates).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

```bash
npx nx test authorization --testPathPattern=authorization.service.spec
```

Expected: 4 new tests fail (F003 logic not yet implemented).

---

## Task 2: Implement the fix

**Files:**
- Modify: `libs/authorization/src/lib/authorization.service.ts`

- [ ] **Step 1: Update `getSafeRowLevelPredicatesForCollection`**

Replace the loop body to:

1. Track each matched rule's predicates in its own branch
2. Detect unconditional grants and return `[]` immediately
3. Return a single `kind: 'or'` predicate when 2+ branches exist
4. Return flat predicates when exactly 1 branch exists (preserve single-rule SQL shape; avoids unnecessary `(X)` wrapping)
5. Return `[]` when no branches (no matched rule with conditions) — the caller's `canAccessCollection` is the operation-level gate

```typescript
async getSafeRowLevelPredicatesForCollection(
  ctx: RequestContext,
  collectionId: string,
  operation: CollectionOperation,
): Promise<SafePredicate[]> {
  // Admin bypass - no row restrictions
  if (ctx.isAdmin) {
    return [];
  }

  if (!this.collectionAclRepo) {
    return [];
  }

  const userContext = this.buildUserContext(ctx);
  const rules = await this.getCollectionRules(collectionId);

  // F003: each matched rule contributes ONE branch. A user matching multiple
  // rules sees the UNION of records each rule grants — branches OR'd together.
  // Predicates WITHIN a single rule's conditions are still AND'd (the rule's
  // "you can read records matching THIS specific condition").
  const branches: SafePredicate[][] = [];

  for (const rule of rules) {
    if (!this.checkPrincipalMatch(rule, userContext)) {
      continue;
    }

    if (!this.checkOperationPermission(rule, operation)) {
      continue;
    }

    if (!rule.conditions) {
      // Unconditional grant — no row restriction wins over any conditional rule.
      return [];
    }

    const rulePredicates = this.extractSafePredicatesFromCondition(
      rule.conditions,
      userContext,
    );
    if (rulePredicates.length > 0) {
      branches.push(rulePredicates);
    }
  }

  if (branches.length === 0) {
    return [];
  }

  if (branches.length === 1) {
    // Single-rule case: emit predicates flat. The caller AND's them via
    // .andWhere() which is the correct semantic for a single rule's
    // multi-predicate condition.
    return branches[0];
  }

  // Multi-rule case (F003): emit a single 'or' predicate whose branches each
  // hold one rule's predicates. AbacService.renderPredicate produces
  // `((A AND B) OR (C AND D))` SQL which is the correct UNION semantic.
  return [{
    kind: 'or',
    branches,
  }];
}
```

- [ ] **Step 2: Run tests, verify they pass**

```bash
npx nx test authorization --testPathPattern=authorization.service.spec
```

Expected: all tests pass (existing tests still green + 4 new tests pass).

---

## Task 3: Verify integration with downstream callers

The fix is intentionally narrow: the change is at predicate ASSEMBLY, not RENDERING. `AbacService.renderPredicate` already handles `kind: 'or'` correctly, and callers iterate `clauses.forEach((c) => qb.andWhere(c))` unchanged. But verify the integration end-to-end.

- [ ] **Step 1: Run all libs/authorization tests**

```bash
npx nx test authorization
```

Expected: all green.

- [ ] **Step 2: Run apps/api tests (the load-bearing consumer)**

```bash
npx nx test api
```

Expected: 34 suites pass, 457 tests pass (no regressions). The data-service tests mock `buildCollectionRowLevelClause` so they don't exercise the F003 code path; they validate the consumer contract is unchanged.

- [ ] **Step 3: Run all 6 architectural scanners**

```bash
npm run authz:check
npm run audit:check
npm run security:check
npm run service-boundary:check
npm run dead-code:check
npm run deps:check
```

Expected: all green.

---

## Task 4: Commit + push + open PR

- [ ] **Step 1: Stage and commit**

```bash
git add libs/authorization/src/lib/authorization.service.ts \
        libs/authorization/src/lib/authorization.service.spec.ts \
        docs/superpowers/plans/2026-05-10-platform-w2-f003-predicate-or-semantics.md
git commit -m "fix(authz): multi-rule row-level predicates OR-combined not AND-combined (F003)

A user matching multiple row-level ACL rules now sees the UNION of records
each rule grants, not the intersection. Predicates within a single rule's
conditions are still AND'd (the rule's specific filter); predicates across
rules are wrapped in a single kind:'or' SafePredicate so AbacService renders
'((rule-A's predicates) OR (rule-B's predicates))'.

A rule with no conditions short-circuits to [] (unconditional grant — no
row restriction wins over any conditional rule).

Tests added in libs/authorization/src/lib/authorization.service.spec.ts:
- single rule emits flat predicates (no unnecessary OR wrapping)
- two rules emit a single 'or' branch with two sub-branches
- SQL emits 'OR' between branches end-to-end
- unconditional grant returns []

Refs PLATFORM-ROADMAP.md Phase 2 W2 / audit finding F003."
```

- [ ] **Step 2: Append completion note to plan, recommit**

- [ ] **Step 3: Push branch + open PR #13**

---

## Self-review

**1. Spec coverage:** F003 alone, scoped tight. F004/F005/F006/F021/F023/F024 deferred to subsequent PRs.

**2. Placeholder scan:** Every step has explicit file paths + commands. No "TBD".

**3. Type consistency:** `SafePredicate` already has `kind: 'or'` discriminant (see `abac.service.ts:20-21` and the existing `renderPredicate` `or` handler at `abac.service.ts:211-227`). No new types needed.

**4. Scope check:** One method changed; 4 new tests; one PR; one day of work.

**5. Edge cases:** Documented in the "Edge cases" table above. Admin bypass unchanged. No-repo unchanged. Single-rule unchanged.

**6. Caller contract:** `clauses.forEach((c) => andWhere(c))` is unchanged — the fix is at the predicate-tree level, transparently rendered by the existing AbacService. No caller-side changes required.

**7. Performance:** Single rule case still emits flat predicates (no OR wrapping). Multi-rule case adds one SafePredicate wrapper but the rendered SQL is functionally equivalent to the existing OR-branch SQL pattern.

No issues found.

---

**End of F003 plan.**

---

## Completion note (2026-05-10)

**Status:** COMPLETE. Implemented at `87d8f72`.

### What landed

- `libs/authorization/src/lib/authorization.service.ts::getSafeRowLevelPredicatesForCollection` rewritten per plan.
- 4 new tests in `authorization.service.spec.ts` covering the F003 semantic.

### Verification

- libs/authorization tests: **24/24 pass** (20 existing + 4 new)
- apps/api tests: **457/457 pass** (no regressions, 2 skipped unchanged)
- All 6 architectural scanners green
- apps/api production build green

### Next

- F004 + F005 (field-level default-deny + masking) — next W2 PR
- F006 (deny rules in ACL model) — bigger conceptual change, separate PR
- F021 (admin bypass audit) — separate PR
- F023 / F024 / F091 / F102 / F136 / F146 — see PLATFORM-ROADMAP.md Phase 2 W2 table for full sequencing
