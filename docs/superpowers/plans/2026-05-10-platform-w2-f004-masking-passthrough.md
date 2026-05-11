# Platform W2 — F004 Fix: Masking strategy passthrough in PropertyAclRepository

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

**Goal:** Fix [F004](../PLATFORM-ROADMAP.md#phase-2--w2--authorization-correctness). `PropertyAclRepository.mapToData` (line 514) hardcodes `maskingStrategy: 'NONE'` instead of reading the entity's `maskingStrategy` column. The DB has the column (migration `1820000000000-access-policy-metadata.ts` added it), the entity declares it (`access-rule.entity.ts:214`), but the DTO swallows it.

Result: a customer admin who configures a property ACL with `maskingStrategy: 'FULL'` for a PHI field gets `'NONE'` at runtime — the masking strategy never reaches the runtime application code. HIPAA-blocking.

**Architecture:** One-line fix in `mapToData`. The downstream consumers (F024's `getAuthorizedFieldsForCollection`, `maskCollectionRecord`) already handle PARTIAL/FULL correctly — they just never see those values today.

**Spec reference:** PLATFORM-ROADMAP.md Phase 2 W2; F004 from audit; `libs/authorization/src/lib/property-acl.repository.ts:514`.

**Predecessor:** F024 fix at master HEAD post-PR-#14 (`8861274`).

**Solo founder, ~30 minutes of work.** 3 tasks: failing test → implementation → commit/PR.

---

## What's wrong today

`libs/authorization/src/lib/property-acl.repository.ts:502-516`:

```typescript
private mapToData(rule: PropertyAccessRule): PropertyAccessRuleData {
  return {
    id: rule.id,
    propertyId: rule.propertyId,
    roleId: rule.roleId,
    groupId: rule.groupId,
    userId: rule.userId,
    canRead: rule.canRead,
    canWrite: rule.canWrite,
    conditions: rule.conditions as AccessConditionData | null,
    priority: rule.priority,
    isActive: rule.isActive,
    maskingStrategy: 'NONE', // ← hardcoded; ignores rule.maskingStrategy
  };
}
```

The entity at `libs/instance-db/src/lib/entities/access-rule.entity.ts:214-215`:

```typescript
@Column({ name: 'masking_strategy', type: 'varchar', length: 20, default: 'NONE' })
maskingStrategy!: 'NONE' | 'PARTIAL' | 'FULL';
```

The migration that added the column (`1820000000000-access-policy-metadata.ts`):

```typescript
ALTER TABLE "property_access_rules"
  ADD COLUMN IF NOT EXISTS "masking_strategy" varchar(20) NOT NULL DEFAULT 'NONE'
```

So everything is in place — the only missing piece is `mapToData` actually using the value.

## Edge cases

| Entity `maskingStrategy` | Today's DTO | After fix |
|---|---|---|
| `'NONE'` | `'NONE'` | `'NONE'` (unchanged) |
| `'PARTIAL'` | `'NONE'` (BUG) | `'PARTIAL'` |
| `'FULL'` | `'NONE'` (BUG) | `'FULL'` |
| `undefined` (e.g., row inserted before column existed) | `'NONE'` | `'NONE'` (entity default applies) |

The migration set `DEFAULT 'NONE'` and `NOT NULL`, so the column is always populated. The `'NONE'` fallback path is dead, but keeping it as a defensive `?? 'NONE'` adds safety against an out-of-spec entity instance.

---

## Task 1: Add failing test

**Files:**
- Create: `libs/authorization/src/lib/property-acl.repository.spec.ts`

The test mocks the TypeORM `Repository<PropertyAccessRule>` and `Repository<PropertyDefinition>` and exercises a public method (`findByProperty`) that transitively calls `mapToData`.

```typescript
import { PropertyAclRepository } from './property-acl.repository';
import type { PropertyAccessRule, PropertyDefinition } from '@hubblewave/instance-db';
import type { Repository } from 'typeorm';

function buildEntity(overrides: Partial<PropertyAccessRule> = {}): PropertyAccessRule {
  return {
    id: 'rule-1',
    propertyId: 'prop-1',
    roleId: null,
    groupId: null,
    userId: null,
    canRead: true,
    canWrite: true,
    maskingStrategy: 'NONE',
    conditions: null,
    priority: 100,
    isActive: true,
    createdBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ruleKey: null,
    metadata: {},
    ...overrides,
  } as PropertyAccessRule;
}

describe('PropertyAclRepository — mapToData (F004)', () => {
  function buildRepoWithRules(rules: PropertyAccessRule[]): PropertyAclRepository {
    const ruleRepo: Partial<Repository<PropertyAccessRule>> = {
      find: jest.fn().mockResolvedValue(rules),
    };
    const propertyRepo: Partial<Repository<PropertyDefinition>> = {
      find: jest.fn().mockResolvedValue([]),
    };
    return new PropertyAclRepository(
      ruleRepo as Repository<PropertyAccessRule>,
      propertyRepo as Repository<PropertyDefinition>,
    );
  }

  it('preserves maskingStrategy "NONE" from entity to DTO', async () => {
    const repo = buildRepoWithRules([buildEntity({ maskingStrategy: 'NONE' })]);
    const [dto] = await repo.findByProperty('prop-1');
    expect(dto.maskingStrategy).toBe('NONE');
  });

  it('preserves maskingStrategy "PARTIAL" from entity to DTO (F004)', async () => {
    const repo = buildRepoWithRules([buildEntity({ maskingStrategy: 'PARTIAL' })]);
    const [dto] = await repo.findByProperty('prop-1');
    expect(dto.maskingStrategy).toBe('PARTIAL');
  });

  it('preserves maskingStrategy "FULL" from entity to DTO (F004)', async () => {
    const repo = buildRepoWithRules([buildEntity({ maskingStrategy: 'FULL' })]);
    const [dto] = await repo.findByProperty('prop-1');
    expect(dto.maskingStrategy).toBe('FULL');
  });

  it('falls back to "NONE" if the entity value is undefined (defensive)', async () => {
    const entity = buildEntity();
    delete (entity as unknown as Record<string, unknown>).maskingStrategy;
    const repo = buildRepoWithRules([entity]);
    const [dto] = await repo.findByProperty('prop-1');
    expect(dto.maskingStrategy).toBe('NONE');
  });
});
```

- [ ] **Step 1: Write the spec file**

- [ ] **Step 2: Run, verify the PARTIAL + FULL tests fail**

```bash
npx nx test authorization --testPathPattern=property-acl.repository.spec
```

Expected: 2 of 4 fail (`PARTIAL`/`FULL` return `'NONE'` today).

---

## Task 2: Apply the one-line fix

**Files:**
- Modify: `libs/authorization/src/lib/property-acl.repository.ts`

- [ ] **Step 1: Replace the hardcoded line**

```typescript
maskingStrategy: rule.maskingStrategy ?? 'NONE',
```

The `?? 'NONE'` keeps a defensive default in case an entity instance is constructed in tests without the field. The DB column is NOT NULL so production rows always populate it; this is purely belt-and-suspenders.

- [ ] **Step 2: Run tests, verify all pass**

```bash
npx nx test authorization
```

Expected: all green (existing 29 + 4 new = 33).

---

## Task 3: Verify integration + commit + PR

- [ ] **Step 1: Run apps/api tests**

```bash
npx nx test api
```

- [ ] **Step 2: Run all 6 scanners**

- [ ] **Step 3: Production build**

```bash
npx nx build api
```

- [ ] **Step 4: Commit + push + open PR #15**

---

## Self-review

**1. Spec coverage:** F004 alone. F005/F006/F021/F023/F091/F102/F136/F146 deferred.

**2. Placeholder scan:** Every step has explicit content. No "TBD".

**3. Type consistency:** No type changes — `maskingStrategy` already typed `'NONE' | 'PARTIAL' | 'FULL'` everywhere.

**4. Scope check:** 1-line code change + 4 new tests. ~30 minutes.

**5. Edge cases:** Documented above. The fallback `?? 'NONE'` covers the entity-without-field defensive case.

**6. Migration safety:** No migration needed — column already exists in DB (`1820000000000`). Pure DTO-mapping fix.

**7. Downstream consumers:** F024 (just landed) already handles PARTIAL/FULL via `leastRestrictiveMask`. `maskCollectionRecord` already calls `applyMask` for non-NONE strategies. The fix activates these downstream code paths that were previously unreachable.

No issues found.

---

**End of F004 plan.**

---

## Completion note (2026-05-10)

**Status:** COMPLETE. Implemented at `5ff14ca`.

### What landed

- `libs/authorization/src/lib/property-acl.repository.ts::mapToData` line 514 now reads `rule.maskingStrategy ?? 'NONE'` instead of hardcoded `'NONE'`.
- Same file's `validateAccessCondition` helper converted from `input.X` to `input['X']` access on its `Record<string, unknown>` input — a latent strict-mode violation that surfaced once the new spec triggered source compilation.
- New `libs/authorization/src/lib/property-acl.repository.spec.ts` covers NONE/PARTIAL/FULL passthrough + defensive undefined fallback.

### Verification

- libs/authorization tests: **33/33 pass** (29 existing + 4 new)
- apps/api tests: **457/457 pass** (no regressions)
- All 6 architectural scanners green
- apps/api production build green

### Next

- F005 — default permissions flip to deny (big blast radius, needs migration plan)
- F006 — explicit deny rules in ACL model
- F021 — admin bypass audit row
- F023 — push principal filter into SQL (perf)
- F091/F102/F136/F146 — application-layer authz fixes

See PLATFORM-ROADMAP.md Phase 2 W2 for full sequencing.
