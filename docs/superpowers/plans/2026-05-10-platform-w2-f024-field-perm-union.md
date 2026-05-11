# Platform W2 — F024 Fix: Field-level permission UNION (not first-match)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Fix [F024](../PLATFORM-ROADMAP.md#phase-2--w2--authorization-correctness): field-level permissions are currently determined by the FIRST matching rule (`break` after first match). A user matching multiple rules should get the **union** of permissions (any rule granting `canRead` → read allowed), not whichever rule happened to sort first. Masking strategy should take the LEAST-restrictive value.

**Architecture:** The fix is in `libs/authorization/src/lib/authorization.service.ts::getAuthorizedFieldsForCollection`. Replace the first-match `break` loop with an iterate-and-combine pattern that takes the OR of `canRead`/`canWrite` and the MIN of masking severity across matching rules. Same conceptual shape as F003 (PR #13) but at field level.

**Tech Stack:** NestJS 11, TypeScript 5.9, TypeORM 0.3, Jest.

**Spec reference:** PLATFORM-ROADMAP.md Phase 2 W2; F024 from audit. Audit notes "same root cause as F003." HIPAA correctness.

**Predecessor:** F003 fix at master HEAD post-PR-#13 (`a66b71e`).

**Solo founder, ~half-day of work.** 4 tasks: failing tests → implementation → integration verification → commit/PR.

---

## What's wrong today

`getAuthorizedFieldsForCollection` (authorization.service.ts:271-300):

```typescript
return fields.map((field) => {
  const fieldRules = propertyRules.filter(
    (r) => r.propertyCode === field.code || r.propertyId === field.code,
  );

  // Default: readable, writable unless system field
  let canRead = true;
  let canWrite = !field.isSystem;
  let maskingStrategy: MaskingStrategy = 'NONE';

  // Apply matching rules (first match wins based on priority)
  for (const rule of fieldRules) {
    if (!this.checkPropertyPrincipalMatch(rule, userContext)) {
      continue;
    }
    canRead = rule.canRead;
    canWrite = rule.canWrite;
    maskingStrategy = rule.maskingStrategy || 'NONE';
    break;  // ← first match wins
  }

  return { ...field, canRead, canWrite, maskingStrategy };
});
```

`propertyRules` is loaded ordered by `priority: ASC`, so the LOWEST priority rule wins. Two users with overlapping rule memberships can see different fields based on which rule sorted first — arbitrary and surprising.

**Examples of the bug:**
- User has rule "analyst:salary-redacted (priority=1, canRead=true, masking=PARTIAL)" and rule "manager:salary-full (priority=10, canRead=true, masking=NONE)". They get partial masking — even though the manager rule grants full visibility.
- User has rule "guest:no-write (priority=1, canRead=true, canWrite=false)" and rule "editor:write (priority=10, canRead=true, canWrite=true)". They can't write — even though the editor rule grants it.

## What right looks like

For a field where the user matches N rules:
- `canRead = true` if ANY matching rule has `canRead: true` (union grant)
- `canWrite = true` if ANY matching rule has `canWrite: true` (union grant)
- `maskingStrategy = LEAST-restrictive` value across matching rules

Masking severity ordering: `NONE` (no mask) < `PARTIAL` (partial mask) < `FULL` (full mask). Less restrictive wins → the user sees the most.

When NO rule matches: keep current default (`canRead: true, canWrite: !isSystem, maskingStrategy: 'NONE'`). F005 will change the default to deny in a separate PR.

## Edge cases

| Scenario | Behavior |
|---|---|
| Admin user | Bypass unchanged (full access, no masking) |
| No `propertyAclRepo` wired | Fallback to default permissions per field (unchanged) |
| No matching rules for a field | Default permissions (unchanged; F005 owns the default flip) |
| One matching rule | Same as current behavior — single rule's values apply |
| Multiple matching rules, all permissive | Most permissive wins (read=true, write=true, masking=NONE) |
| Multiple matching rules with mixed read | `canRead = true` if any grants it |
| Multiple matching rules with mixed masking | LEAST-restrictive wins (`NONE` > `PARTIAL` > `FULL`) |
| Rule has `maskingStrategy: undefined` | Treated as `'NONE'` (unchanged) |

---

## Task 1: Add failing tests for field-permission UNION

**Files:**
- Modify: `libs/authorization/src/lib/authorization.service.spec.ts`

- [ ] **Step 1: Append new describe block at the end of the file**

Test the canonical multi-rule scenarios:

```typescript
describe('AuthorizationService — multi-rule field permissions (F024)', () => {
  const ROLE_GUEST = '55555555-5555-5555-5555-555555555555';
  const ROLE_MANAGER = '66666666-6666-6666-6666-666666666666';
  const FIELD_SALARY: PropertyMeta = { code: 'salary' };

  function buildFieldRule(overrides: Partial<PropertyAccessRuleData> = {}): PropertyAccessRuleData {
    return {
      id: 'field-rule',
      propertyId: 'salary',
      propertyCode: 'salary',
      collectionId: COLLECTION_ID,
      roleId: null,
      groupId: null,
      userId: null,
      canRead: true,
      canWrite: true,
      conditions: null,
      priority: 1,
      isActive: true,
      maskingStrategy: 'NONE',
      ...overrides,
    };
  }

  function buildMultiRoleContext(roles: string[]): RequestContext {
    return {
      userId: 'user-1',
      roles,
      permissions: [],
      isAdmin: false,
      attributes: { roleIds: roles },
    } as unknown as RequestContext;
  }

  it('canRead is true if ANY matching rule grants read (union)', async () => {
    const { service } = buildService({
      propertyRules: [
        buildFieldRule({ id: 'r-restrictive', roleId: ROLE_GUEST, priority: 1, canRead: false }),
        buildFieldRule({ id: 'r-permissive', roleId: ROLE_MANAGER, priority: 10, canRead: true }),
      ],
    });

    const [authorized] = await service.getAuthorizedFieldsForCollection(
      buildMultiRoleContext([ROLE_GUEST, ROLE_MANAGER]),
      COLLECTION_ID,
      [FIELD_SALARY],
    );

    expect(authorized.canRead).toBe(true);
  });

  it('canWrite is true if ANY matching rule grants write (union)', async () => {
    const { service } = buildService({
      propertyRules: [
        buildFieldRule({ id: 'r-readonly', roleId: ROLE_GUEST, priority: 1, canWrite: false }),
        buildFieldRule({ id: 'r-editor', roleId: ROLE_MANAGER, priority: 10, canWrite: true }),
      ],
    });

    const [authorized] = await service.getAuthorizedFieldsForCollection(
      buildMultiRoleContext([ROLE_GUEST, ROLE_MANAGER]),
      COLLECTION_ID,
      [FIELD_SALARY],
    );

    expect(authorized.canWrite).toBe(true);
  });

  it('maskingStrategy is LEAST-restrictive across matching rules (NONE wins over PARTIAL wins over FULL)', async () => {
    const { service } = buildService({
      propertyRules: [
        buildFieldRule({ id: 'r-full-mask', roleId: ROLE_GUEST, priority: 1, maskingStrategy: 'FULL' }),
        buildFieldRule({ id: 'r-partial-mask', roleId: ROLE_GUEST, priority: 2, maskingStrategy: 'PARTIAL' }),
        buildFieldRule({ id: 'r-no-mask', roleId: ROLE_MANAGER, priority: 10, maskingStrategy: 'NONE' }),
      ],
    });

    const [authorized] = await service.getAuthorizedFieldsForCollection(
      buildMultiRoleContext([ROLE_GUEST, ROLE_MANAGER]),
      COLLECTION_ID,
      [FIELD_SALARY],
    );

    expect(authorized.maskingStrategy).toBe('NONE');
  });

  it('non-matching rules are ignored even when present', async () => {
    const { service } = buildService({
      propertyRules: [
        // ROLE_GUEST grants nothing — user does not have this role.
        buildFieldRule({ id: 'r-irrelevant', roleId: ROLE_GUEST, canRead: false, canWrite: false, maskingStrategy: 'FULL' }),
        buildFieldRule({ id: 'r-applies', roleId: ROLE_MANAGER, canRead: true, canWrite: true, maskingStrategy: 'NONE' }),
      ],
    });

    const [authorized] = await service.getAuthorizedFieldsForCollection(
      buildMultiRoleContext([ROLE_MANAGER]),  // only manager
      COLLECTION_ID,
      [FIELD_SALARY],
    );

    expect(authorized.canRead).toBe(true);
    expect(authorized.canWrite).toBe(true);
    expect(authorized.maskingStrategy).toBe('NONE');
  });

  it('falls back to default permissions when no rule matches', async () => {
    const { service } = buildService({
      propertyRules: [
        buildFieldRule({ id: 'r-other-role', roleId: ROLE_GUEST, canRead: false, canWrite: false }),
      ],
    });

    // User has neither ROLE_GUEST nor ROLE_MANAGER — no rules match.
    const [authorized] = await service.getAuthorizedFieldsForCollection(
      buildMultiRoleContext([ROLE_VIEWER]),
      COLLECTION_ID,
      [FIELD_SALARY],
    );

    // Current default — F005 will change this in a future PR.
    expect(authorized.canRead).toBe(true);
    expect(authorized.canWrite).toBe(true);
    expect(authorized.maskingStrategy).toBe('NONE');
  });
});
```

- [ ] **Step 2: Run tests, verify the multi-rule tests fail**

```bash
npx nx test authorization --testPathPattern=authorization.service.spec
```

Expected: tests for `canRead union`, `canWrite union`, `maskingStrategy LEAST-restrictive` should fail (current first-match-wins picks the priority-1 restrictive rule). The "non-matching ignored" and "fallback default" tests should pass (unchanged behavior).

---

## Task 2: Implement the F024 fix

**Files:**
- Modify: `libs/authorization/src/lib/authorization.service.ts`

- [ ] **Step 1: Replace the first-match loop with combine-matching-rules**

```typescript
return fields.map((field) => {
  const fieldRules = propertyRules.filter(
    (r) => r.propertyCode === field.code || r.propertyId === field.code,
  );

  // Default permissions when no rule matches the user. F005 will change
  // these defaults to deny in a separate PR; until then, fields are
  // read+write by default with no masking (current behavior preserved).
  let canRead = true;
  let canWrite = !field.isSystem;
  let maskingStrategy: MaskingStrategy = 'NONE';
  let matched = false;

  // F024: combine ALL matching rules instead of first-match-wins.
  // canRead = any rule grants read (union).
  // canWrite = any rule grants write (union).
  // maskingStrategy = LEAST-restrictive value across matching rules
  // (NONE < PARTIAL < FULL — the user sees the most).
  for (const rule of fieldRules) {
    if (!this.checkPropertyPrincipalMatch(rule, userContext)) {
      continue;
    }

    if (!matched) {
      // First matching rule: replace defaults entirely. Without this
      // reset, the lib-wide "default = allow-all" would mask out a
      // restrictive rule with no other matches.
      canRead = rule.canRead;
      canWrite = rule.canWrite;
      maskingStrategy = rule.maskingStrategy ?? 'NONE';
      matched = true;
      continue;
    }

    canRead = canRead || rule.canRead;
    canWrite = canWrite || rule.canWrite;
    maskingStrategy = leastRestrictiveMask(maskingStrategy, rule.maskingStrategy ?? 'NONE');
  }

  return { ...field, canRead, canWrite, maskingStrategy };
});
```

- [ ] **Step 2: Add `leastRestrictiveMask` helper inside the class**

Define near other private helpers (e.g., after `checkPropertyPrincipalMatch`):

```typescript
/**
 * Returns the LESS-restrictive of two masking strategies (NONE < PARTIAL
 * < FULL). Used by F024 multi-rule field combination: when a user matches
 * multiple field rules, the user sees the most data, not the least.
 */
private static readonly MASK_SEVERITY: Record<MaskingStrategy, number> = {
  NONE: 0,
  PARTIAL: 1,
  FULL: 2,
};

private leastRestrictiveMask(a: MaskingStrategy, b: MaskingStrategy): MaskingStrategy {
  return AuthorizationService.MASK_SEVERITY[a] <= AuthorizationService.MASK_SEVERITY[b] ? a : b;
}
```

- [ ] **Step 3: Run tests, verify all pass**

```bash
npx nx test authorization --testPathPattern=authorization.service.spec
```

Expected: all 5 new F024 tests pass + previous 24 tests still pass.

---

## Task 3: Verify integration

- [ ] **Step 1: Run all libs/authorization tests**

```bash
npx nx test authorization
```

- [ ] **Step 2: Run apps/api tests**

```bash
npx nx test api
```

Expected: 34 suites, 457 tests pass (no regressions). Mocks for `getAuthorizedFieldsForCollection` are not affected; live consumers (data.service, ava-preview, dashboards) read the canonical post-combine values.

- [ ] **Step 3: Run all 6 architectural scanners**

```bash
npm run authz:check && npm run audit:check && npm run security:check && \
npm run service-boundary:check && npm run dead-code:check && npm run deps:check
```

- [ ] **Step 4: apps/api production build**

```bash
npx nx build api
```

---

## Task 4: Commit + push + open PR #14

- [ ] **Step 1: Stage and commit**

```bash
git add libs/authorization/src/lib/authorization.service.ts \
        libs/authorization/src/lib/authorization.service.spec.ts \
        docs/superpowers/plans/2026-05-10-platform-w2-f024-field-perm-union.md
git commit -m "fix(authz): field permissions UNION across matching rules (F024)
..."
```

- [ ] **Step 2: Append completion note to plan**

- [ ] **Step 3: Push + open PR #14**

---

## Self-review

**1. Spec coverage:** F024 alone, well-bounded. F005 (default flip), F004 (masking enforcement), F006 (deny rules) deferred to subsequent PRs.

**2. Placeholder scan:** All code shown. No "TBD".

**3. Type consistency:** Uses existing `MaskingStrategy` enum (`'NONE' | 'PARTIAL' | 'FULL'`). Adds `MASK_SEVERITY` static map + `leastRestrictiveMask` private helper.

**4. Scope check:** ~30 LoC change in one method + helper. 5 new tests.

**5. Edge cases:** Documented above. Admin/no-repo/single-rule/no-match preserved.

**6. Consistency with F003:** Same UNION pattern at field level. The mental model "multiple rules = union of permissions" is now consistent across row-level and field-level.

**7. Default deny scope:** F005 deferred — current defaults preserved.

No issues found.

---

**End of F024 plan.**

---

## Completion note (2026-05-10)

**Status:** COMPLETE. Implemented at `ec22290`.

### What landed

- `libs/authorization/src/lib/authorization.service.ts`:
  - `getAuthorizedFieldsForCollection` rewritten: first-match-with-break replaced by iterate-and-combine
  - New private `leastRestrictiveMask` helper + static `MASK_SEVERITY` map (NONE=0, PARTIAL=1, FULL=2)
- `libs/authorization/src/lib/authorization.service.spec.ts`: 5 new tests covering F024 multi-rule semantics

### Verification

- libs/authorization tests: **29/29 pass** (24 existing + 5 new)
- apps/api tests: **457/457 pass** (2 skipped, 0 regressions)
- All 6 architectural scanners green
- apps/api production build green

### Next

- F005 — flip default permissions to deny (would affect every field with no matching rule)
- F004 — verify masking is actually enforced end-to-end (the rule data has the strategy; need to ensure it's applied at read time)
- F006 — explicit deny rules in ACL model (allows policies like "guest sees nothing even if a default rule grants")
- F021 — admin bypass audit row (canon §10 compliance)
- F023 — push collection-rule principal filter into SQL (perf, not correctness)
- See PLATFORM-ROADMAP.md Phase 2 W2 for full sequencing
