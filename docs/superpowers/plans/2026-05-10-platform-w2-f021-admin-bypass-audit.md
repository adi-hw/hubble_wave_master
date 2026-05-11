# Platform W2 — F021 Fix: Admin bypass audit

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

**Goal:** Fix [F021](../PLATFORM-ROADMAP.md). Today, every admin path in `AuthorizationService` bypasses ACL evaluation via `if (ctx.isAdmin) return ...` with no record of who-did-what — directly violates canon §10 ("every action explainable, including by whom and under which permission"). Add an audit row per bypass.

**Architecture:** Port/adapter pattern. `libs/authorization` defines `AccessAuditPort` interface; `apps/api` provides the impl by routing to the existing `AccessAuditService` (which writes to `AccessAuditLog`). DI is optional — when the port is unbound, the lib falls back to silent bypass (matches current behavior). The audit call is fire-and-forget; never blocks the request.

**Tech Stack:** NestJS 11, TypeScript 5.9, Jest. No DB migration needed (the `AccessAuditLog` table already exists).

**Predecessor:** PR #16 (F091+F102+F146) at master HEAD.

**Solo founder, ~2 hours of work.** 4 tasks: failing tests → port + helper → call-site instrumentation + wiring → verify/PR.

---

## Bypass sites in scope

After tracing every `if (ctx.isAdmin)` block:

| Site | Method | Audit decision |
|---|---|---|
| line ~82 | `canAccessCollection` | **AUDIT** — the canonical access gate |
| line ~134 | `getSafeRowLevelPredicatesForCollection` | AUDIT — row-filter bypass is a real bypass |
| line ~178 | `buildCollectionRowLevelClause` | AUDIT — analogue for the wrapper |
| line ~215 | `getAuthorizedFieldsForCollection` (admin branch) | AUDIT — field-perm bypass |
| line ~362 | `canAccessCollectionRecord` | AUDIT — record-level bypass |
| line ~394 | `maskCollectionRecord` | AUDIT — masking bypass |
| line ~448 | `canAccessTable` (deprecated wrapper) | AUDIT |
| line ~463 | `ensureTableAccess` (deprecated wrapper) | AUDIT |
| line ~478 | `getSafeRowLevelPredicates` (deprecated wrapper) | AUDIT |
| line ~494 | `buildRowLevelClause` (deprecated wrapper) | AUDIT |
| line ~509 | `getAuthorizedFields` (deprecated wrapper) | AUDIT |

A shared private helper keeps the call-site instrumentation to one line per site.

## Edge cases

| Scenario | Behavior |
|---|---|
| `AccessAuditPort` not bound in DI (e.g. lib used outside apps/api) | Silent — helper checks for null port. Matches current behavior. |
| Audit write fails (DB down, table missing) | Helper logs to platform logger; never re-throws. Same posture as `RuntimeAnomalyService.record` and the existing `AccessAuditService.logAccess`. |
| Non-admin user (`ctx.isAdmin=false`) | Helper returns immediately. No audit row. |
| Admin user, port wired | One audit row per bypass site touched. May fire multiple times per request (e.g. canAccessCollection + getAuthorizedFieldsForCollection). Acceptable — forensics value beats noise. |

---

## Task 1: Add failing tests for the port + bypass instrumentation

**Files:**
- Modify: `libs/authorization/src/lib/authorization.service.spec.ts`

Test plan:

1. **Port is optional** — service constructs and operates without the port (mirrors today's tests).
2. **`canAccessCollection` admin bypass → port called** with `{ userId, resource: collectionId, action: operation }`.
3. **`canAccessCollectionRecord` admin bypass → port called** (separate site).
4. **`getAuthorizedFieldsForCollection` admin bypass → port called** with action `'fields:read'`.
5. **`maskCollectionRecord` admin bypass → port called** with action `'mask'`.
6. **Non-admin path does NOT call the port** (negative test — fires on a regular ACL match).
7. **Port write failure does NOT crash the bypass path** — port that throws still allows the bypass to return; the lib must not crash.

Implementation outline (append to the spec after the F024 block):

```typescript
describe('AuthorizationService — admin bypass audit (F021)', () => {
  function buildAdminContext(): RequestContext {
    return {
      userId: 'admin-1',
      roles: ['role-admin'],
      permissions: [],
      isAdmin: true,
      attributes: { roleIds: ['role-admin'] },
    } as unknown as RequestContext;
  }

  function buildServiceWithAudit(audit: AccessAuditPort | null): {
    service: AuthorizationService;
    audit: AccessAuditPort | null;
  } {
    const policyCompiler = new PolicyCompilerService();
    const collectionAclRepo: CollectionAclRepoStub = { find: jest.fn().mockResolvedValue([]) };
    const propertyAclRepo: PropertyAclRepoStub = { find: jest.fn().mockResolvedValue([]) };
    const service = new AuthorizationService(
      collectionAclRepo,
      propertyAclRepo,
      null,
      null,
      policyCompiler,
      null,
      audit,  // ← new 7th positional arg
    );
    return { service, audit };
  }

  it('canAccessCollection admin bypass calls the port', async () => {
    const port: AccessAuditPort = { logAdminBypass: jest.fn() };
    const { service } = buildServiceWithAudit(port);
    await service.canAccessCollection(buildAdminContext(), COLLECTION_ID, 'read');
    expect(port.logAdminBypass).toHaveBeenCalledTimes(1);
    expect(port.logAdminBypass).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'admin-1',
      resource: COLLECTION_ID,
      action: 'read',
    }));
  });

  it('canAccessCollectionRecord admin bypass calls the port', async () => { ... });
  it('getAuthorizedFieldsForCollection admin bypass calls the port', async () => { ... });
  it('maskCollectionRecord admin bypass calls the port', async () => { ... });

  it('non-admin path does NOT call the port', async () => {
    const port: AccessAuditPort = { logAdminBypass: jest.fn() };
    const { service } = buildServiceWithAudit(port);
    await service.canAccessCollection(buildContext(), COLLECTION_ID, 'read');
    expect(port.logAdminBypass).not.toHaveBeenCalled();
  });

  it('port not bound: bypass still works (no port required)', async () => {
    const { service } = buildServiceWithAudit(null);
    const allowed = await service.canAccessCollection(buildAdminContext(), COLLECTION_ID, 'read');
    expect(allowed).toBe(true);
  });

  it('port write failure does not crash the bypass path', async () => {
    const port: AccessAuditPort = {
      logAdminBypass: jest.fn(() => { throw new Error('audit DB down'); }),
    };
    const { service } = buildServiceWithAudit(port);
    const allowed = await service.canAccessCollection(buildAdminContext(), COLLECTION_ID, 'read');
    expect(allowed).toBe(true);  // bypass still returns true
  });
});
```

- [ ] **Step 1: Add the import** at top of spec: `import type { AccessAuditPort } from './audit-port';` (file will be created in Task 2)

- [ ] **Step 2: Add the describe block** at end of file

- [ ] **Step 3: Run tests — expect ALL new ones to fail** (constructor doesn't accept 7th arg yet)

```bash
npx nx test authorization
```

---

## Task 2: Define the port + helper

**Files:**
- Create: `libs/authorization/src/lib/audit-port.ts`
- Modify: `libs/authorization/src/lib/authorization.service.ts` (add helper, update constructor)
- Modify: `libs/authorization/src/index.ts` (export new symbols)

- [ ] **Step 1: Create `libs/authorization/src/lib/audit-port.ts`**

```typescript
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
 * persistence); throwing here would mask the runtime decision the
 * platform was trying to record.
 */
export interface AccessAuditPort {
  logAdminBypass(event: AccessAuditEvent): void;
}

export interface AccessAuditEvent {
  /** Admin's user ID (from RequestContext.userId). */
  userId: string;
  /** Resource identifier — collectionId UUID, table name, or 'admin:wildcard'. */
  resource: string;
  /** Logical action — 'read' / 'create' / 'update' / 'delete' / 'fields:read' / 'mask' / etc. */
  action: string;
  /** Optional structured context (e.g. recordId for record-level bypass). */
  context?: Record<string, unknown>;
}

export const ACCESS_AUDIT_PORT = 'ACCESS_AUDIT_PORT';
```

- [ ] **Step 2: Update constructor in `authorization.service.ts`**

Add a 7th positional parameter (matching the spec's expectation):

```typescript
constructor(
  @Optional() @Inject(COLLECTION_ACL_REPOSITORY)
  private readonly collectionAclRepo: CollectionAclRepo | null,
  @Optional() @Inject(PROPERTY_ACL_REPOSITORY)
  private readonly propertyAclRepo: PropertyAclRepo | null,
  @Optional() @Inject(CACHE_MANAGER)
  private readonly cache: Cache | null,
  @Optional()
  private readonly abacService: AbacService | null,
  private readonly policyCompiler: PolicyCompilerService,
  @Optional() @Inject(COLLECTION_DEFINITION_REPOSITORY)
  private readonly collectionDefinitionRepo: CollectionDefinitionLookupRepo | null = null,
  @Optional() @Inject(ACCESS_AUDIT_PORT)
  private readonly accessAudit: AccessAuditPort | null = null,
) {}
```

- [ ] **Step 3: Add private helper**

Place near `leastRestrictiveMask` (after other private helpers):

```typescript
/**
 * Fire-and-forget audit emission for admin bypass sites. Never throws —
 * a failing port write is logged to the platform logger but must not
 * affect the bypass return value (canon §10 audit must not regress
 * runtime correctness).
 */
private auditAdminBypass(
  ctx: RequestContext,
  resource: string,
  action: string,
  context?: Record<string, unknown>,
): void {
  if (!this.accessAudit) return;
  try {
    this.accessAudit.logAdminBypass({
      userId: ctx.userId,
      resource,
      action,
      context,
    });
  } catch (err) {
    this.logger.warn(
      `Admin bypass audit emit failed for user=${ctx.userId} resource=${resource} action=${action}: ${(err as Error).message}`,
    );
  }
}
```

- [ ] **Step 4: Export the new symbols** from `libs/authorization/src/index.ts`

Add:
```typescript
export type { AccessAuditPort, AccessAuditEvent } from './lib/audit-port';
export { ACCESS_AUDIT_PORT } from './lib/audit-port';
```

- [ ] **Step 5: Run tests — port-optional + bypass-works tests should pass, but bypass-fires-audit tests still fail** (no instrumentation yet)

---

## Task 3: Instrument the bypass sites + wire impl in apps/api

**Files:**
- Modify: `libs/authorization/src/lib/authorization.service.ts` (instrument 11 sites)
- Modify: `apps/api/src/app/metadata/access/services/access-audit.service.ts` (add `logAdminBypass`)
- Modify: `apps/api/src/app/metadata/access/access.module.ts` (provide port binding)

- [ ] **Step 1: Instrument all 11 admin bypass sites**

At each `if (ctx.isAdmin) {` block, add the helper call BEFORE the early return. Pattern per site:

```typescript
// canAccessCollection
if (ctx.isAdmin) {
  this.auditAdminBypass(ctx, collectionId, operation);
  return true;
}

// canAccessCollectionRecord
if (ctx.isAdmin) {
  this.auditAdminBypass(ctx, collectionId, operation, { recordId: String(record?.['id'] ?? null) });
  return true;
}

// getAuthorizedFieldsForCollection (admin branch)
if (ctx.isAdmin) {
  this.auditAdminBypass(ctx, collectionId, 'fields:read');
  return fields.map(...);
}

// maskCollectionRecord
if (ctx.isAdmin) {
  this.auditAdminBypass(ctx, 'record', 'mask');
  return record;
}

// getSafeRowLevelPredicatesForCollection
if (ctx.isAdmin) {
  this.auditAdminBypass(ctx, collectionId, `${operation}:row-filter`);
  return [];
}

// buildCollectionRowLevelClause
if (ctx.isAdmin) {
  this.auditAdminBypass(ctx, collectionId, `${operation}:row-clause`);
  return { clauses: [], params: {} };
}

// canAccessTable, ensureTableAccess, getSafeRowLevelPredicates, buildRowLevelClause, getAuthorizedFields
// — pass tableName as the resource (translation to collectionId happens after the bypass)
```

Each is a 1-line addition.

- [ ] **Step 2: Add `logAdminBypass` to `AccessAuditService`**

```typescript
logAdminBypass(event: AccessAuditEvent): void {
  const log = this.auditRepo.create({
    userId: event.userId,
    resource: event.resource,
    action: event.action,
    decision: 'ALLOW',
    context: {
      adminBypass: true,
      ...event.context,
    },
  });
  // Fire-and-forget; never re-throw.
  this.auditRepo.save(log).catch((err) => {
    this.logger.error('Failed to write admin bypass audit log', err);
  });
}
```

Also implement the `AccessAuditPort` interface on the class declaration.

- [ ] **Step 3: Bind the port in `apps/api/src/app/metadata/access/access.module.ts`**

```typescript
providers: [
  AccessAuditService,
  {
    provide: ACCESS_AUDIT_PORT,
    useExisting: AccessAuditService,  // AccessAuditService implements AccessAuditPort
  },
  // ...existing providers
],
exports: [
  AccessAuditService,
  ACCESS_AUDIT_PORT,
  // ...
],
```

- [ ] **Step 4: Verify `AuthorizationModule` imports the new providers** (or that the port is somehow visible in the same DI scope as `AuthorizationService`)

If the module wiring doesn't already expose the port to AuthorizationService's scope, add the necessary `imports`/`providers` re-export. Investigate by reading both modules.

- [ ] **Step 5: Run tests — all F021 tests pass**

```bash
npx nx test authorization
```

- [ ] **Step 6: Add unit test for `AccessAuditService.logAdminBypass`** in its existing spec (or co-locate)

---

## Task 4: Verify + commit + PR #17

- [ ] **Step 1: Full suite**

```bash
npx nx test authorization
npx nx test api
```

Expected: all green; 469+ apps/api tests + 33+ libs/authorization tests pass.

- [ ] **Step 2: All 6 scanners**

```bash
npm run authz:check
npm run audit:check
npm run security:check
npm run service-boundary:check
npm run dead-code:check
npm run deps:check
```

- [ ] **Step 3: Production build**

```bash
npx nx build api
```

- [ ] **Step 4: Commit + push + open PR #17**

---

## Self-review

**1. Spec coverage:** F021 alone. F005/F006/F023/F136 deferred to separate PRs.

**2. Placeholder scan:** Every step has explicit content. No "TBD".

**3. Type consistency:** New types (`AccessAuditPort`, `AccessAuditEvent`) live in libs/authorization. `ACCESS_AUDIT_PORT` is a Nest DI token string.

**4. Scope check:** ~10 LoC per call site × 11 sites + helper + port file + apps/api wiring + 7 new tests. ~250 LoC total. ~2 hours.

**5. Edge cases:** Port-not-bound preserves current behavior. Port-throws is swallowed. Non-admin path is untouched.

**6. Performance:** Audit is fire-and-forget at the port (existing `AccessAuditService.logAccess` pattern). Bypass paths stay synchronous-returning (no new await).

**7. Layering:** libs/authorization defines the port; apps/api provides the impl. Lib doesn't reach into apps/api. Clean.

**8. Migration:** None. `AccessAuditLog` table already exists from initial schema.

No issues found.

---

**End of F021 plan.**

---

## Completion note (2026-05-10)

**Status:** COMPLETE. Implemented at `38d5fcb`.

### What landed

- NEW `libs/authorization/src/lib/audit-port.ts`: `AccessAuditPort` interface, `AccessAuditEvent` type, `ACCESS_AUDIT_PORT` DI token
- `libs/authorization/src/lib/authorization.service.ts`: 7th constructor arg (optional port); new private `auditAdminBypass` helper; 11 admin bypass sites instrumented
- `libs/authorization/src/index.ts`: exports the new port symbols
- `apps/api/src/app/metadata/access/services/access-audit.service.ts`: now `implements AccessAuditPort`; new `logAdminBypass` method writes to `AccessAuditLog` with `context.additionalData.adminBypass: true`
- `apps/api/src/app/metadata/access/access.module.ts`: binds `AccessAuditService` to `ACCESS_AUDIT_PORT` via `useExisting`; exports the token

### Verification

- libs/authorization tests: **40/40 pass** (33 prior + 7 new F021)
- apps/api tests: **469/469 pass** (no regressions)
- All 6 scanners green
- apps/api production build green

### Next

- F005 — default-deny flip (high blast radius; needs migration plan or per-collection flag)
- F006 — explicit deny rules in ACL model (entity migration + types + evaluation order)
- F023 — push principal filter into SQL (performance)
- F136 — search authz pre-filter (Typesense + vector engines need a restructured search abstraction)
