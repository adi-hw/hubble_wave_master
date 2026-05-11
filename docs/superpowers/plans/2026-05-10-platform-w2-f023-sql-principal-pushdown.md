# Platform W2 — F023 Fix: SQL principal-filter pushdown

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

**Goal:** Fix [F023](../PLATFORM-ROADMAP.md). `AuthorizationService.getCollectionRules` fetches ALL active rules for a collection then filters them in JS via `checkPrincipalMatch`. The production `CollectionAclRepository` already has a `findByCollectionAndUser` method that does the principal filter in SQL — F023 is just wiring it in.

**Architecture:** Extend the inline `CollectionAclRepo` interface to optionally expose `findByCollectionAndUser`. `getCollectionRules` calls it when the repo provides it; falls back to `find()` otherwise (preserves backward-compat for test stubs that only implement the simpler interface). Cache key includes a principal-hash component so per-user filtered results don't poison the cache. `checkPrincipalMatch` stays in the call sites as defense — the SQL filter is the optimization; JS is the safety net.

**Tech Stack:** NestJS 11, TypeScript 5.9, Jest. No DB migration.

**Predecessor:** PR #17 (F021) at master HEAD.

**Solo founder, ~1.5 hours of work.** 3 tasks: failing tests → interface + service rewire → verify/PR.

---

## Edge cases

| Scenario | Behavior |
|---|---|
| Repo provides `findByCollectionAndUser` (production) | SQL fetches only applicable rules; per-user cache key |
| Repo provides only `find` (test stubs) | Falls back to per-collection fetch + JS filter (today's behavior) |
| Admin user | `auditAdminBypass` fires (F021), early return — `getCollectionRules` not called at all |
| Empty role/group arrays | Pass to SQL with a sentinel UUID (matches existing `CollectionAclRepository.findByCollectionAndUser` impl) |
| Cache key collision across users | Principal hash stable per user; different users get different keys |

---

## Task 1: Failing tests for SQL filter wiring

**Files:**
- Modify: `libs/authorization/src/lib/authorization.service.spec.ts`

Tests verify that when a repo with `findByCollectionAndUser` is wired:
1. `canAccessCollection` calls `findByCollectionAndUser`, NOT `find`
2. The user's `userId`, `roleIds`, `groupIds` are passed
3. When the repo lacks the method, the service falls back to `find` (preserves backward-compat)
4. Cache key differentiates per-user when the filtered method is used

Append a new describe block:

```typescript
describe('AuthorizationService — SQL principal-filter pushdown (F023)', () => {
  function buildSqlFilteredRepo(rules: CollectionAccessRuleData[]) {
    return {
      find: jest.fn().mockResolvedValue(rules),
      findByCollectionAndUser: jest.fn().mockResolvedValue(rules),
    };
  }

  it('uses findByCollectionAndUser when the repo provides it', async () => {
    const repo = buildSqlFilteredRepo([buildReadRule()]);
    const policyCompiler = new PolicyCompilerService();
    const service = new AuthorizationService(
      repo, { find: jest.fn().mockResolvedValue([]) },
      null, null, policyCompiler, null, null,
    );

    await service.canAccessCollection(buildContext(), COLLECTION_ID, 'read');

    expect(repo.findByCollectionAndUser).toHaveBeenCalledTimes(1);
    expect(repo.findByCollectionAndUser).toHaveBeenCalledWith(
      COLLECTION_ID,
      'user-1',
      [ROLE_VIEWER],
      [],
    );
    expect(repo.find).not.toHaveBeenCalled();
  });

  it('falls back to find when the repo lacks findByCollectionAndUser (test-stub compat)', async () => {
    const stubRepo = { find: jest.fn().mockResolvedValue([buildReadRule()]) };
    // No findByCollectionAndUser method
    const policyCompiler = new PolicyCompilerService();
    const service = new AuthorizationService(
      stubRepo, { find: jest.fn().mockResolvedValue([]) },
      null, null, policyCompiler, null, null,
    );

    await service.canAccessCollection(buildContext(), COLLECTION_ID, 'read');

    expect(stubRepo.find).toHaveBeenCalledTimes(1);
  });

  it('passes groupIds + teamIds combined to the SQL filter', async () => {
    const repo = buildSqlFilteredRepo([]);
    const policyCompiler = new PolicyCompilerService();
    const service = new AuthorizationService(
      repo, { find: jest.fn().mockResolvedValue([]) },
      null, null, policyCompiler, null, null,
    );

    const ctx = {
      userId: 'user-1',
      roles: [ROLE_VIEWER],
      permissions: [],
      isAdmin: false,
      attributes: {
        roleIds: [ROLE_VIEWER],
        groupIds: ['group-a'],
        teamIds: ['team-b'],
      },
    } as unknown as RequestContext;

    await service.canAccessCollection(ctx, COLLECTION_ID, 'read');

    expect(repo.findByCollectionAndUser).toHaveBeenCalledWith(
      COLLECTION_ID,
      'user-1',
      [ROLE_VIEWER],
      expect.arrayContaining(['group-a', 'team-b']),
    );
  });
});
```

- [ ] **Step 1: Append the describe block**
- [ ] **Step 2: Run — expect 1 fail + 1 pass + 1 fail** (`findByCollectionAndUser` not called yet; fallback test passes since `find` is already called today)

```bash
npx nx test authorization
```

---

## Task 2: Wire the SQL filter

**Files:**
- Modify: `libs/authorization/src/lib/authorization.service.ts`

- [ ] **Step 1: Extend the inline `CollectionAclRepo` interface** (around line 28)

```typescript
interface CollectionAclRepo {
  find(options: { where: Record<string, unknown>; order?: Record<string, string> }): Promise<CollectionAccessRuleData[]>;
  /**
   * F023: when the repo can filter by principal in SQL, use this overload to
   * avoid the fetch-all-then-JS-filter pattern. Returns the same shape as
   * `find` but pre-filtered to rules whose principal matches the user
   * (own userId, any of roleIds, any of groupIds, or the all-NULL "applies
   * to everyone" rule).
   */
  findByCollectionAndUser?(
    collectionId: string,
    userId: string,
    roleIds: string[],
    groupIds: string[],
  ): Promise<CollectionAccessRuleData[]>;
}
```

- [ ] **Step 2: Update `getCollectionRules` to take an optional user context**

```typescript
private async getCollectionRules(
  collectionId: string,
  user?: UserAccessContext,
): Promise<CollectionAccessRuleData[]> {
  if (!this.collectionAclRepo) {
    return [];
  }

  // F023: when the repo can filter by principal in SQL AND we have a user
  // context, use the filtered path. Cache key includes a principal hash so
  // per-user results don't poison entries across users.
  const useSqlFilter = !!(user && this.collectionAclRepo.findByCollectionAndUser);
  const cacheKey = useSqlFilter
    ? `auth:collection-rules:${collectionId}:${this.principalCacheKey(user!)}`
    : `auth:collection-rules:${collectionId}`;

  if (this.cache) {
    const cached = await this.cache.get<CollectionAccessRuleData[]>(cacheKey);
    if (cached) return cached;
  }

  const rules = useSqlFilter
    ? await this.collectionAclRepo.findByCollectionAndUser!(
        collectionId,
        user!.userId,
        user!.roleIds,
        [...user!.groupIds, ...user!.teamIds],
      )
    : await this.collectionAclRepo.find({
        where: { collectionId, isActive: true },
        order: { priority: 'ASC' },
      });

  if (this.cache) {
    await this.cache.set(cacheKey, rules, this.CACHE_TTL);
  }

  return rules;
}
```

- [ ] **Step 3: Add a stable principal-hash helper** (near `leastRestrictiveMask`)

```typescript
/**
 * Stable hash of a user's principal identity for use as a cache key
 * component (F023). Sorts each id list before joining so two contexts
 * with the same principals but different array order hash identically.
 */
private principalCacheKey(user: UserAccessContext): string {
  const roles = [...user.roleIds].sort().join(',');
  const groups = [...user.groupIds].sort().join(',');
  const teams = [...user.teamIds].sort().join(',');
  return `${user.userId}|${roles}|${groups}|${teams}`;
}
```

- [ ] **Step 4: Update callers to pass user**

In `canAccessCollection`, `canAccessCollectionRecord`, `getSafeRowLevelPredicatesForCollection`:
- They all already build `userContext` via `this.buildUserContext(ctx)` before calling `getCollectionRules`
- Just pass it: `await this.getCollectionRules(collectionId, userContext)`

`checkPrincipalMatch` calls in those methods STAY — they're now belt-and-suspenders defense against an out-of-spec repo. Rules returned by SQL-filter ARE all applicable, but the JS double-check is cheap (the result set is small).

- [ ] **Step 5: Tests pass**

```bash
npx nx test authorization
```

---

## Task 3: Verify + commit + PR

- [ ] **Step 1: Full apps/api regression**

```bash
npx nx test api
```

The production `CollectionAclRepository` already implements `findByCollectionAndUser`, so apps/api tests will now exercise the SQL-filter path (some tests may need their mocks updated if they returned different rule sets via `find` vs `findByCollectionAndUser`).

- [ ] **Step 2: All 6 scanners**

- [ ] **Step 3: apps/api production build**

- [ ] **Step 4: Commit + push + open PR #18**

---

## Self-review

**1. Scope:** F023 ONLY for `getCollectionRules`. `getPropertyRules` has a similar pattern but requires a new repo method (`findByCollectionAndUser` for property rules) — deferred to a follow-up.

**2. Backward-compat:** Optional `findByCollectionAndUser` on the interface keeps existing test stubs working.

**3. Cache key:** Includes principal hash when SQL-filtered. Different users get different cache entries; existing per-collection cache key path preserved for stub-only deployments.

**4. checkPrincipalMatch defense:** Stays in call sites as a safety net. After F023 it filters a smaller list (≤ all applicable rules per user) and is a tautology when SQL filter is in play, but cheap and protects against a misimplemented repo.

**5. No correctness change:** Same rules returned (same applicable set). Performance change only.

**6. No migration:** `findByCollectionAndUser` is purely a SELECT — no schema change.

No issues found.

---

**End of F023 plan.**
