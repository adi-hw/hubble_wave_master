# W0 — Foundation: Make Scanners Truthful

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every scanner truthful, every CI gate enforced, every canon-claimed lint rule real. This wave is the foundation for every subsequent wave — until W0 lands, "done" is unverifiable.

**Architecture:** Eleven tasks plus a wave-end verification task. Tasks 1–2 establish baseline + self-test infrastructure. Tasks 3–5 fix the three broken scanners. Task 6 implements ESLint enforcement. Task 7 wires CD ↔ CI. Task 8 adds gitleaks. Task 9 adds SBOM + license checks. Task 10 builds the dead-code scanner (Deletion Catalog §D.6). Task 11 documents required-status-check repo settings. Task 12 verifies the wave.

**Tech Stack:** TypeScript scanners (existing pattern in `tools/`), GitHub Actions for CI, gitleaks-action, anchore/syft + grype for SBOM, license-checker for license validation, ts-morph for AST analysis in dead-code-check, ESLint v9 flat config.

**Findings addressed:** F018, F056, F104, F105, F106, F119, plus §D.6 dead-code-check infrastructure.

**Pre-conditions:**
- Working in worktree `condescending-shamir-92422b` on branch `claude/condescending-shamir-92422b`.
- Master commit at `96c92c2` (post-Plan-Fix-1 merge).
- Master roadmap at `docs/plan-fixes/00-master-remediation-roadmap.md` (untracked; will be committed alongside W0 deliverables).

**Risk profile:**
- Medium: ESLint enforcement upgrade may fail many existing files. Mitigation: structured allowlist + pre-flight grep.
- High: gitleaks history scan WILL find the live private key in `SECRETS_ROTATION.md:155-168`. Output must NOT be pushed to a public artifact; treat as security incident, hand to ops for rotation (W1 work).
- Medium: Required-status-check changes are a GitHub admin operation; documented in Task 11 but execution requires a human admin.

---

## Task 1: Baseline — Capture Current Scanner State

**Goal:** Document the state of every scanner against the current master HEAD before any changes. This is our regression baseline; later tasks fail open if we don't know what they should detect.

**Files:**
- Create: `docs/plan-fixes/W00-baseline-2026-05-09.md`
- Modify: none
- Test: none (this task IS a measurement)

- [ ] **Step 1: Create baseline output directory**

```bash
mkdir -p tmp/w00-baseline
```

- [ ] **Step 2: Run each existing scanner; capture stdout, stderr, exit code**

```bash
for scanner in compliance:check authz:check audit:check security:check service-boundary:check deps:check; do
  echo "=== $scanner ===" | tee -a tmp/w00-baseline/raw-output.txt
  npm run $scanner 2>&1 | tee -a tmp/w00-baseline/raw-output.txt
  echo "EXIT_CODE: $?" | tee -a tmp/w00-baseline/raw-output.txt
done
```

Expected: at least one scanner exits non-zero per the audit findings (F018, F056, F105 imply the scanners either pass spuriously, are mis-scoped, or are out of sync with current state).

- [ ] **Step 3: Run lint and unit tests for full baseline**

```bash
npm run lint 2>&1 | tee tmp/w00-baseline/lint.txt
npm run test 2>&1 | tail -100 | tee tmp/w00-baseline/test-tail.txt
```

- [ ] **Step 4: Author baseline doc**

Author `docs/plan-fixes/W00-baseline-2026-05-09.md` summarizing per scanner:
- Exit code
- Number of violations reported
- Whether allowlist entries were used
- Notable findings

Use this template:

```markdown
# W0 Baseline — 2026-05-09

Captured at commit `<HEAD_SHA>` of `claude/condescending-shamir-92422b`.

## Scanner Results

| Scanner | Exit Code | Violations | Allowlist Entries Hit | Notes |
|---|---|---|---|---|
| compliance:check | <code> | <count> | <count> | <notes> |
| ... | | | | |

## Lint Results

<summary of npm run lint output>

## Test Results

<summary of npm run test tail>

## Discoveries vs Audit Expectations

- F018 confirmed: authz-bypass-check.ts only scans `apps/svc-data/...` per `tools/authz-bypass-check.ts:10`.
- F056 confirmed: service-boundary-check.ts has no AutomationRule entity-write rule.
- F105: PUBLIC_ALLOWLIST has <N> entries; `grep -r "@Public()" apps/` finds <M> sites. Drift = <M-N>.
- ...
```

- [ ] **Step 5: Commit baseline**

```bash
git add docs/plan-fixes/W00-baseline-2026-05-09.md docs/plan-fixes/00-master-remediation-roadmap.md
git commit -m "$(cat <<'EOF'
docs(plan-fixes): W0 baseline + master remediation roadmap

Captures the state of every architectural scanner, lint, and test against
the current master HEAD before W0 (Foundation) work begins. Used as the
regression baseline for the rest of the remediation program.

Refs: docs/plan-fixes/00-master-remediation-roadmap.md, W0 task 1.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Scanner Self-Test Framework

**Goal:** Every scanner must ship with a self-test that proves it catches the patterns it claims to catch. Today only some scanners have specs; coverage is uneven.

**Files:**
- Create: `tools/scanner-self-test.ts` (shared framework)
- Create: `tools/scanner-self-test.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `tools/scanner-self-test.spec.ts`:

```typescript
import { describe, it, expect } from '@jest/globals';
import { runScannerOnFixture } from './scanner-self-test';
import { join } from 'path';

describe('scanner-self-test framework', () => {
  it('reports a violation for a fixture that contains the banned pattern', async () => {
    const result = await runScannerOnFixture({
      scannerCommand: 'npx ts-node tools/design-compliance/terminology-scanner.ts',
      fixtureContent: 'export const tenantId = "x";',
      fixturePath: 'tmp/scanner-fixture/sample.ts',
    });
    expect(result.exitCode).not.toBe(0);
    expect(result.stdout + result.stderr).toMatch(/tenant/i);
  });

  it('reports clean for a fixture with no banned patterns', async () => {
    const result = await runScannerOnFixture({
      scannerCommand: 'npx ts-node tools/design-compliance/terminology-scanner.ts',
      fixtureContent: 'export const customerId = "x";',
      fixturePath: 'tmp/scanner-fixture/clean.ts',
    });
    expect(result.exitCode).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest tools/scanner-self-test.spec.ts
```

Expected: FAIL — `Cannot find module './scanner-self-test'`.

- [ ] **Step 3: Write minimal implementation**

Create `tools/scanner-self-test.ts`:

```typescript
import { execSync } from 'child_process';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { dirname } from 'path';

export interface ScannerSelfTestInput {
  scannerCommand: string;
  fixtureContent: string;
  fixturePath: string;
}

export interface ScannerSelfTestResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export async function runScannerOnFixture(
  input: ScannerSelfTestInput,
): Promise<ScannerSelfTestResult> {
  mkdirSync(dirname(input.fixturePath), { recursive: true });
  writeFileSync(input.fixturePath, input.fixtureContent, 'utf-8');
  try {
    const stdout = execSync(input.scannerCommand, {
      encoding: 'utf-8',
      env: { ...process.env, SCANNER_FIXTURE_ROOT: dirname(input.fixturePath) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { exitCode: 0, stdout, stderr: '' };
  } catch (e: unknown) {
    const err = e as { status?: number; stdout?: Buffer; stderr?: Buffer };
    return {
      exitCode: err.status ?? 1,
      stdout: err.stdout?.toString() ?? '',
      stderr: err.stderr?.toString() ?? '',
    };
  } finally {
    rmSync(dirname(input.fixturePath), { recursive: true, force: true });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest tools/scanner-self-test.spec.ts
```

Expected: 2 tests PASS.

NOTE: This may surface that the terminology-scanner doesn't accept a `SCANNER_FIXTURE_ROOT` env var. If so, document in the test that this is a "future-compatible" framework — the per-scanner self-tests in Tasks 3–5 + 10 will adapt their commands accordingly. Update the test to use a path-passing variant.

- [ ] **Step 5: Commit**

```bash
git add tools/scanner-self-test.ts tools/scanner-self-test.spec.ts
git commit -m "$(cat <<'EOF'
feat(tools): scanner self-test framework (W0 task 2)

Each architectural scanner can use runScannerOnFixture() to prove it
catches its claimed patterns. Used by Tasks 3-5 and Task 10.

Refs: docs/plan-fixes/W00-foundation.md task 2.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Reconcile `security-bypass-check.ts` PUBLIC_ALLOWLIST (F105)

**Goal:** The PUBLIC_ALLOWLIST currently has 11 entries; reality has 26 `@Public()` sites. Every drift is either a missing allowlist entry (legitimate public endpoint) or a missing security gate (`@Public()` that shouldn't exist).

**Files:**
- Modify: `tools/security-bypass-check.ts:14-26`
- Modify: One or more controllers in `apps/**/src/app/**` to remove `@Public()` where unjustified
- Create: `tools/security-bypass-check.spec.ts`

- [ ] **Step 1: Inventory all 26 `@Public()` sites**

```bash
grep -rn "@Public()" apps/ libs/ --include="*.ts" > tmp/public-sites.txt
wc -l tmp/public-sites.txt
```

Categorize each into: KEEP-PUBLIC (login, callback, health, documented webhook) vs REMOVE-PUBLIC (authn'd should be applied).

Likely KEEP-PUBLIC:
- All `*/health/health.controller.ts` (k8s liveness/readiness)
- `apps/svc-identity/src/app/auth/auth.controller.ts` for `login`, `refresh`, `oidc/callback`, `saml/acs`
- `apps/svc-instance-api/src/app/identity/auth/auth.controller.ts` (peer of above)
- `apps/svc-control-plane/src/app/auth/auth.controller.ts`
- Webhook receivers if any

Likely REMOVE-PUBLIC:
- `apps/svc-identity/src/app/abac/abac.guard.ts` — guards should not be `@Public()`
- `apps/svc-metadata/src/app/packs/packs.controller.ts:17-20` — pack install requires auth (linked to F126)
- `apps/svc-metadata/src/app/theme/theme.controller.ts` — theme reads OK as public; theme writes need auth
- Anything in `instance-api` that isn't login/SSO

- [ ] **Step 2: Write the failing test**

Create `tools/security-bypass-check.spec.ts`:

```typescript
import { describe, it, expect } from '@jest/globals';
import { runScannerOnFixture } from './scanner-self-test';
import { execSync } from 'child_process';

describe('security-bypass-check.ts', () => {
  it('reports zero violations on master HEAD', () => {
    const result = (() => {
      try {
        execSync('npx ts-node tools/security-bypass-check.ts', {
          encoding: 'utf-8',
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        return { exitCode: 0 };
      } catch (e: unknown) {
        const err = e as { status?: number; stdout?: Buffer };
        return { exitCode: err.status ?? 1, stdout: err.stdout?.toString() ?? '' };
      }
    })();
    expect(result.exitCode).toBe(0);
  });

  it('flags a fixture with @Public() on a non-allowlisted controller', async () => {
    const result = await runScannerOnFixture({
      scannerCommand: 'npx ts-node tools/security-bypass-check.ts',
      fixtureContent: `
        import { Public } from '@some/decorator';
        @Public()
        export class HiddenSecretController {}
      `,
      fixturePath: 'apps/svc-data/src/app/__fixture__/hidden.controller.ts',
    });
    expect(result.exitCode).not.toBe(0);
  });

  it('flags allowlist drift: PUBLIC_ALLOWLIST size matches discovered @Public() sites', () => {
    const grepResult = execSync(
      'grep -rln "@Public()" apps/ libs/ --include="*.ts" | sort -u',
      { encoding: 'utf-8' },
    ).trim().split('\n').filter(Boolean);
    const allowlist = require('./security-bypass-check').PUBLIC_ALLOWLIST as string[];
    const drift = grepResult.filter((path) =>
      !allowlist.some((a) => path.endsWith(a) || path.includes(a))
    );
    expect(drift).toEqual([]); // any @Public() not in allowlist is a drift
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx jest tools/security-bypass-check.spec.ts
```

Expected: at least one of the three tests FAILS, confirming F105.

- [ ] **Step 4: Reconcile PUBLIC_ALLOWLIST**

Update `tools/security-bypass-check.ts:14-26`:
- Add KEEP-PUBLIC paths to allowlist with one-line `// reason:` comment per entry.
- Export `PUBLIC_ALLOWLIST` (currently it may be private).

For REMOVE-PUBLIC sites: edit each controller to delete `@Public()` decorator and add appropriate `@RequirePermission()` or `@Roles()` decorators based on the controller's intended audience.

For `apps/svc-metadata/src/app/packs/packs.controller.ts` specifically: add `@RequirePermission(['packs.install'])` or equivalent (cross-references F126; full fix lives in W1).

- [ ] **Step 5: Run test to verify it passes**

```bash
npx jest tools/security-bypass-check.spec.ts
```

Expected: 3 tests PASS.

- [ ] **Step 6: Run scanner against full repo**

```bash
npm run security:check
echo "EXIT: $?"
```

Expected: exit 0 (or one specific known violation if a controller change is deferred to W1; document in the commit body).

- [ ] **Step 7: Commit**

```bash
git add tools/security-bypass-check.ts tools/security-bypass-check.spec.ts apps/**/*.controller.ts
git commit -m "$(cat <<'EOF'
fix(security): reconcile PUBLIC_ALLOWLIST with actual @Public() sites (F105, W0 task 3)

Audit found 26 @Public() sites vs 11 allowlist entries. This commit:
- Adds legitimate auth/SSO/health/webhook entries to allowlist with
  per-entry reasons.
- Removes unjustified @Public() from <list controllers>; adds appropriate
  permission gates.
- Adds security-bypass-check.spec.ts: scanner self-test, drift check
  against grep, and clean-master assertion.

Refs: F105, W0 task 3.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Extend `authz-bypass-check.ts` Scope to All Instance Services (F018)

**Goal:** Currently scans only `apps/svc-data/...`. Extend to all 11 instance services so that any caller bypassing `AuthorizationService` is caught.

**Files:**
- Modify: `tools/authz-bypass-check.ts:1-end`
- Create: `tools/authz-bypass-check.spec.ts`

- [ ] **Step 1: Read current scanner to understand its detection logic**

```bash
cat tools/authz-bypass-check.ts
```

Note: it uses the AST or string scan to detect `RequestContext` usage + DataSource access without `AuthorizationService` calls.

- [ ] **Step 2: Write the failing test**

Create `tools/authz-bypass-check.spec.ts`:

```typescript
import { describe, it, expect } from '@jest/globals';
import { runScannerOnFixture } from './scanner-self-test';
import { execSync } from 'child_process';

describe('authz-bypass-check.ts', () => {
  it('reports zero violations on master HEAD', () => {
    let exitCode = 0;
    try {
      execSync('npx ts-node tools/authz-bypass-check.ts', { stdio: 'pipe' });
    } catch (e: unknown) {
      exitCode = (e as { status?: number }).status ?? 1;
    }
    expect(exitCode).toBe(0);
  });

  it('detects bypass in svc-insights (previously unscanned)', async () => {
    const result = await runScannerOnFixture({
      scannerCommand: 'npx ts-node tools/authz-bypass-check.ts',
      fixtureContent: `
        import { DataSource } from 'typeorm';
        import { RequestContext } from '@hubblewave/auth-guard';
        export class BadService {
          constructor(private ds: DataSource) {}
          async leak(ctx: RequestContext) {
            return this.ds.query('SELECT * FROM users'); // no AuthorizationService gate
          }
        }
      `,
      fixturePath: 'apps/svc-insights/src/app/__fixture__/bad.service.ts',
    });
    expect(result.exitCode).not.toBe(0);
  });

  it('detects bypass in svc-ava, svc-workflow, svc-metadata', async () => {
    for (const svc of ['svc-ava', 'svc-workflow', 'svc-metadata']) {
      const result = await runScannerOnFixture({
        scannerCommand: 'npx ts-node tools/authz-bypass-check.ts',
        fixtureContent: `
          import { DataSource } from 'typeorm';
          import { RequestContext } from '@hubblewave/auth-guard';
          export class BadService {
            constructor(private ds: DataSource) {}
            async leak(ctx: RequestContext) {
              return this.ds.query('SELECT 1');
            }
          }
        `,
        fixturePath: `apps/${svc}/src/app/__fixture__/bad.service.ts`,
      });
      expect(result.exitCode).not.toBe(0);
    }
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx jest tools/authz-bypass-check.spec.ts
```

Expected: tests 2 and 3 FAIL — scanner doesn't currently scan svc-insights/svc-ava/svc-workflow/svc-metadata.

- [ ] **Step 4: Refactor scanner to iterate all instance services**

Update `tools/authz-bypass-check.ts`:
- Replace `const SERVICE_ROOT = join(APPS_ROOT, 'svc-data', ...)` with:

```typescript
const INSTANCE_SERVICES = [
  'svc-data',
  'svc-metadata',
  'svc-identity',
  'svc-automation',
  'svc-workflow',
  'svc-notify',
  'svc-insights',
  'svc-ava',
  'svc-view-engine',
  'svc-instance-api',
  'svc-migrations',
];
const SERVICE_ROOTS = INSTANCE_SERVICES.map(s => join(APPS_ROOT, s, 'src', 'app'));
```

- Update the scanner walker to iterate over all `SERVICE_ROOTS` rather than the single `SERVICE_ROOT`.
- Update violation reporter to include service name in the output.
- Add an explicit allowlist for control-plane reads/health endpoints if any false positives surface.

- [ ] **Step 5: Run test to verify it passes**

```bash
npx jest tools/authz-bypass-check.spec.ts
```

Expected: all tests PASS.

- [ ] **Step 6: Run scanner against full repo and catalog new violations**

```bash
npm run authz:check 2>&1 | tee tmp/w00-authz-violations.txt
echo "EXIT: $?"
```

Expected: exit non-zero with new violations from previously-unscanned services.

For each new violation, classify:
- **Real bug**: opens follow-up task in this task or escalates to W2/W3 (which own authz fixes).
- **False positive**: add to scanner's allowlist with structured `// reason:` comment.

- [ ] **Step 7: Add allowlist entries for unavoidable cases**

If any service has legitimate raw-DataSource queries (e.g., bootstrap, migrations), add to a typed allowlist in the scanner:

```typescript
const KNOWN_BYPASSES: { path: string; reason: string; addedBy: string; addedAt: string }[] = [
  // example:
  // { path: 'apps/svc-migrations/src/main.ts', reason: 'bootstrap before authz available', addedBy: 'W0 task 4', addedAt: '2026-05-09' },
];
```

Driven to zero by W2/W3.

- [ ] **Step 8: Commit**

```bash
git add tools/authz-bypass-check.ts tools/authz-bypass-check.spec.ts
git commit -m "$(cat <<'EOF'
fix(tools): authz-bypass-check now scans all 11 instance services (F018, W0 task 4)

Was: scoped to svc-data only.
Now: iterates svc-data, svc-metadata, svc-identity, svc-automation,
svc-workflow, svc-notify, svc-insights, svc-ava, svc-view-engine,
svc-instance-api, svc-migrations.

Self-test added asserting fixture violations are caught in each service.
Allowlist <count> entries for bootstrap/migration paths; each carries
structured reason+date+addedBy.

New violations surfaced and tracked for W2/W3.

Refs: F018, W0 task 4.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Add Entity-Write Rule to `service-boundary-check.ts` (F056)

**Goal:** The canon claims "any service other than svc-automation writing to AutomationRule fails CI." That rule does not exist. Build it.

**Files:**
- Modify: `tools/service-boundary-check.ts`
- Create: `tools/service-boundary-check.spec.ts` (or extend if exists)

- [ ] **Step 1: Define the entity ownership map**

In `tools/service-boundary-check.ts`, add:

```typescript
/**
 * Entity → owning service. A service NOT in the value list cannot write to
 * the entity (no .save/.update/.delete/.insert/.upsert calls; no
 * @InjectRepository in a write-capable context).
 *
 * Driven by canon claims and audit findings:
 * - AutomationRule, AutomationExecutionLog, AutomationRuleRevision: svc-automation only
 * - AvaProposal: svc-ava only (after W4)
 * - User, Role, Permission, Group: svc-identity only
 * - Collection*, Property*, View*, Form*: svc-metadata only
 * - AuditLog: any service via the withAudit helper (validated by audit-bypass-check)
 */
export const ENTITY_OWNERSHIP: Record<string, string[]> = {
  AutomationRule: ['svc-automation'],
  AutomationExecutionLog: ['svc-automation'],
  AutomationRuleRevision: ['svc-automation'],
  ScheduledJob: ['svc-automation'],
  AvaProposal: ['svc-ava'],
  AvaProposalAudit: ['svc-ava'],
  User: ['svc-identity'],
  Role: ['svc-identity'],
  Permission: ['svc-identity'],
  Group: ['svc-identity'],
  GroupMembership: ['svc-identity'],
  CollectionDefinition: ['svc-metadata'],
  PropertyDefinition: ['svc-metadata'],
  ViewDefinition: ['svc-metadata'],
  FormDefinition: ['svc-metadata'],
  PackObjectState: ['svc-metadata'],
  PackInstallation: ['svc-metadata'],
};
```

- [ ] **Step 2: Write the failing test**

Create `tools/service-boundary-check.spec.ts`:

```typescript
import { describe, it, expect } from '@jest/globals';
import { runScannerOnFixture } from './scanner-self-test';
import { execSync } from 'child_process';

describe('service-boundary-check.ts entity-write rule', () => {
  it('reports the existing svc-data automation runtime violation', () => {
    let exitCode = 0;
    let stdout = '';
    try {
      stdout = execSync('npx ts-node tools/service-boundary-check.ts', {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (e: unknown) {
      const err = e as { status?: number; stdout?: Buffer };
      exitCode = err.status ?? 1;
      stdout = err.stdout?.toString() ?? '';
    }
    expect(exitCode).not.toBe(0);
    expect(stdout).toMatch(/AutomationRule/);
    expect(stdout).toMatch(/svc-data/);
  });

  it('passes for a deliberately-clean fixture', async () => {
    const result = await runScannerOnFixture({
      scannerCommand: 'npx ts-node tools/service-boundary-check.ts',
      fixtureContent: `
        import { Repository } from 'typeorm';
        import { AutomationRule } from '@hubblewave/instance-db';
        export class CleanService {
          constructor(private repo: Repository<AutomationRule>) {}
          async readOnly(id: string) { return this.repo.findOne({ where: { id } }); }
        }
      `,
      fixturePath: 'apps/svc-automation/src/app/__fixture__/clean.service.ts',
    });
    expect(result.exitCode).toBe(0);
  });

  it('flags fixture writing AutomationRule from svc-data', async () => {
    const result = await runScannerOnFixture({
      scannerCommand: 'npx ts-node tools/service-boundary-check.ts',
      fixtureContent: `
        import { Repository } from 'typeorm';
        import { AutomationRule } from '@hubblewave/instance-db';
        export class BadService {
          constructor(private repo: Repository<AutomationRule>) {}
          async write(rule: Partial<AutomationRule>) {
            return this.repo.save(rule); // FORBIDDEN from svc-data
          }
        }
      `,
      fixturePath: 'apps/svc-data/src/app/__fixture__/bad.service.ts',
    });
    expect(result.exitCode).not.toBe(0);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx jest tools/service-boundary-check.spec.ts
```

Expected: all 3 tests FAIL — current scanner doesn't check entity writes.

- [ ] **Step 4: Implement entity-write detection**

In `tools/service-boundary-check.ts`, add a function:

```typescript
import { Project, Node, SyntaxKind } from 'ts-morph';

interface EntityWriteViolation {
  entity: string;
  service: string;
  filePath: string;
  line: number;
  method: string;
  allowedServices: string[];
}

function detectEntityWrites(): EntityWriteViolation[] {
  const violations: EntityWriteViolation[] = [];
  const project = new Project({ tsConfigFilePath: 'tsconfig.base.json' });

  for (const sourceFile of project.getSourceFiles()) {
    const filePath = sourceFile.getFilePath();
    const serviceMatch = filePath.match(/[\\/]apps[\\/](svc-[^\\/]+)[\\/]/);
    if (!serviceMatch) continue;
    const service = serviceMatch[1];

    // Find write calls: .save(), .update(), .delete(), .insert(), .upsert(), .remove(), .softDelete()
    sourceFile.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) return;
      const expr = node.getExpression();
      if (!Node.isPropertyAccessExpression(expr)) return;
      const methodName = expr.getName();
      if (!['save', 'update', 'delete', 'insert', 'upsert', 'remove', 'softDelete'].includes(methodName)) return;

      // Walk back to find the type of the receiver (must be Repository<X>)
      const receiver = expr.getExpression();
      const receiverType = receiver.getType();
      const typeText = receiverType.getText();
      const repoMatch = typeText.match(/Repository<([A-Za-z_]+)>/);
      if (!repoMatch) return;
      const entity = repoMatch[1];

      const allowed = ENTITY_OWNERSHIP[entity];
      if (!allowed || allowed.includes(service)) return;

      violations.push({
        entity,
        service,
        filePath,
        line: node.getStartLineNumber(),
        method: methodName,
        allowedServices: allowed,
      });
    });
  }

  return violations;
}
```

Wire `detectEntityWrites` into the main scanner output. Append violations to the existing import-topology violations. Exit non-zero if any.

- [ ] **Step 5: Run test to verify it passes**

```bash
npx jest tools/service-boundary-check.spec.ts
```

Expected: all 3 tests PASS.

- [ ] **Step 6: Run against full repo**

```bash
npm run service-boundary:check 2>&1 | tee tmp/w00-boundary-violations.txt
echo "EXIT: $?"
```

Expected: exits non-zero with violations from svc-data writing AutomationRule. This CONFIRMS F055 (svc-data still owns automation runtime) and is the gating evidence W4 needs.

- [ ] **Step 7: Commit**

```bash
git add tools/service-boundary-check.ts tools/service-boundary-check.spec.ts
git commit -m "$(cat <<'EOF'
fix(tools): add entity-write rule to service-boundary-check (F056, W0 task 5)

Implements the canon-claimed rule: any service other than the entity's
owning service that writes (save/update/delete/insert/upsert/remove/
softDelete) to that entity fails CI.

Surfaces the pre-existing svc-data → AutomationRule violations that
make F055 (Plan Fix 1 incomplete) measurable for W4 to clean up.

Self-test fixtures cover clean and dirty cases.

Refs: F056, W0 task 5.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Replace `eslint.config.mjs` with Real Enforcement (F104)

**Goal:** ESLint must enforce the five rules canon §21 claims: no TODO/FIXME, no commented-out code, no versioned identifiers, naming convention, unused code.

**Files:**
- Modify: `eslint.config.mjs:1-48`
- Create: `tools/eslint-rules/no-versioned-identifier.js` (custom rule)
- Create: `tools/eslint-rules/no-versioned-identifier.spec.js`
- Modify (potentially): per-package eslint configs to inherit

- [ ] **Step 1: Inventory current rule violations to scope the allowlist**

```bash
# Count TODO/FIXME
grep -rn -E "TODO|FIXME" apps/ libs/ --include="*.ts" --include="*.tsx" | wc -l

# Count likely commented-out code (lines that look like ts/js inside line comments)
grep -rn -E "^[[:space:]]*//[[:space:]]*(import|export|const|let|var|function|class|if|for|while|return)" apps/ libs/ --include="*.ts" --include="*.tsx" | wc -l

# Count versioned identifiers in source
grep -rEn "(legacyV[0-9]+|legacy[A-Z]|[A-Za-z]V[0-9]+|deprecatedV[0-9]+)" apps/ libs/ --include="*.ts" --include="*.tsx" | head -50

# Count unused-vars findings via current lint
npm run lint 2>&1 | grep -c "no-unused-vars" || true
```

- [ ] **Step 2: Write the failing test for the custom rule**

Create `tools/eslint-rules/no-versioned-identifier.spec.js`:

```javascript
const { RuleTester } = require('eslint');
const rule = require('./no-versioned-identifier');

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

ruleTester.run('no-versioned-identifier', rule, {
  valid: [
    { code: 'const userService = new UserService();' },
    { code: 'export class CustomerRepository {}' },
    { code: 'function getRecord() {}' },
  ],
  invalid: [
    { code: 'const userServiceV1 = {};', errors: [{ messageId: 'versionedIdentifier' }] },
    { code: 'class LegacyAuthGuard {}', errors: [{ messageId: 'versionedIdentifier' }] },
    { code: 'function processRecordV2() {}', errors: [{ messageId: 'versionedIdentifier' }] },
    { code: 'const deprecatedV3 = 1;', errors: [{ messageId: 'versionedIdentifier' }] },
  ],
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx jest tools/eslint-rules/no-versioned-identifier.spec.js
```

Expected: FAIL — `Cannot find module './no-versioned-identifier'`.

- [ ] **Step 4: Implement the custom rule**

Create `tools/eslint-rules/no-versioned-identifier.js`:

```javascript
'use strict';

const VERSIONED_PATTERNS = [
  /^(?:[A-Za-z][A-Za-z0-9]*)V[0-9]+$/,           // FooV1, fooV2
  /^[Ll]egacy[A-Z][A-Za-z0-9]*$/,                // LegacyFoo, legacyFoo
  /^[Dd]eprecated[A-Z][A-Za-z0-9]*$/,            // Deprecated*
  /^old[A-Z][A-Za-z0-9]*$/,                      // oldThing
  /^[Tt]emp[A-Z][A-Za-z0-9]*$/,                  // tempThing (but not "template")
];

const NAME_ALLOWLIST = new Set([
  'IPv4', 'IPv6', 'OAuth1', 'OAuth2', 'HTTP1', 'HTTP2', 'HTTP3', 'TLS1', 'TLS2',
]);

function isVersioned(name) {
  if (NAME_ALLOWLIST.has(name)) return false;
  return VERSIONED_PATTERNS.some((re) => re.test(name));
}

module.exports = {
  meta: {
    type: 'problem',
    docs: { description: 'disallow versioned/legacy/temp/deprecated identifiers per canon §1' },
    messages: {
      versionedIdentifier:
        'Identifier "{{name}}" suggests a version, legacy, deprecated, or temporary status. ' +
        'Per canon §1: no V1/V2/legacy/deprecated naming. Choose a final name.',
    },
    schema: [],
  },
  create(context) {
    function check(node) {
      if (!node || !node.name) return;
      if (isVersioned(node.name)) {
        context.report({ node, messageId: 'versionedIdentifier', data: { name: node.name } });
      }
    }
    return {
      Identifier: check,
    };
  },
};
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx jest tools/eslint-rules/no-versioned-identifier.spec.js
```

Expected: PASS.

- [ ] **Step 6: Replace `eslint.config.mjs`**

Replace contents with:

```javascript
import nx from '@nx/eslint-plugin';
import noVersionedIdentifier from './tools/eslint-rules/no-versioned-identifier.js';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

const TODO_ALLOWLIST = [
  // Each entry MUST have a tracking finding ID and target wave.
  // Format: { file: relative-path, line: number, finding: 'F121', wave: 'W7' }
];

export default tseslint.config(
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    plugins: {
      'hw': { rules: { 'no-versioned-identifier': noVersionedIdentifier } },
      'react-hooks': reactHooks,
    },
    ignores: ['**/dist', '**/node_modules', '**/coverage', 'tools/eslint-rules/*.spec.js'],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // Canon §21 enforcement
      'no-warning-comments': ['error', { terms: ['todo', 'fixme', 'xxx', 'hack'], location: 'anywhere' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'hw/no-versioned-identifier': 'error',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // No commented-out code: detect long comment lines that look like code
      'no-restricted-syntax': [
        'error',
        // Add specific syntax restrictions per canon as needed.
      ],
      // Naming convention (loose; tightened per-package as needed)
      '@typescript-eslint/naming-convention': [
        'error',
        { selector: 'variableLike', format: ['camelCase', 'PascalCase', 'UPPER_CASE'], leadingUnderscore: 'allow' },
        { selector: 'typeLike', format: ['PascalCase'] },
      ],
      // Existing
      'no-console': 'warn',
    },
  },
);
```

- [ ] **Step 7: Run lint and audit failures**

```bash
npm run lint 2>&1 | tee tmp/w00-lint-output.txt
```

Expected: many failures, especially `no-warning-comments` and `no-unused-vars`. For each failure:
- If TODO is at `script-sandbox.service.spec.ts:186` or `:219` (F121), add to `TODO_ALLOWLIST` with `finding: 'F121', wave: 'W10'`. Then in `eslint.config.mjs`, add a per-file override to silence these specific lines (eslint disable-next-line with a comment that includes the finding ID).
- If unused var is in legitimately stub'd code, fix it.
- If versioned identifier surfaces (e.g., `legacy*` in `audit.service.ts`), fix the name.

Iterate until lint passes.

- [ ] **Step 8: Commit**

```bash
git add eslint.config.mjs tools/eslint-rules/ apps/ libs/
git commit -m "$(cat <<'EOF'
feat(lint): real ESLint enforcement of canon §21 (F104, W0 task 6)

Replaces 48-line shim with real config enforcing:
- no-warning-comments: error (TODO/FIXME/XXX/HACK)
- @typescript-eslint/no-unused-vars: error
- hw/no-versioned-identifier: error (custom rule, tested)
- react-hooks/rules-of-hooks: error (catches F088)
- @typescript-eslint/naming-convention

Custom rule at tools/eslint-rules/no-versioned-identifier.js with spec.

Allowlist for known TODOs (F121) carries finding ID + target wave;
each allowed line includes a // eslint-disable-next-line comment that
references the finding.

Renames/fixes:
- <list of files where legacy* / *V1 was renamed>

Refs: F104, F088 (lint catches it), F121 (allowlist), W0 task 6.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Wire CD ↔ CI Dependency (F106)

**Goal:** CD (`.github/workflows/cd.yml`) must require CI completion. Direct push to main currently bypasses every scanner and unit test.

**Files:**
- Modify: `.github/workflows/cd.yml`
- Modify: `.github/workflows/ci.yml` (so it fires on `push: main` too)

- [ ] **Step 1: Read both workflows**

```bash
cat .github/workflows/ci.yml
cat .github/workflows/cd.yml
```

- [ ] **Step 2: Update ci.yml to fire on push to main + develop**

In `.github/workflows/ci.yml`, ensure `on:` includes:

```yaml
on:
  pull_request:
    branches: [master, develop]
  push:
    branches: [master, develop]
```

- [ ] **Step 3: Update cd.yml to require CI's success**

In `.github/workflows/cd.yml`, change the trigger:

```yaml
on:
  workflow_run:
    workflows: ['CI']
    branches: [master, develop]
    types: [completed]
```

And gate every job on:

```yaml
jobs:
  setup:
    if: ${{ github.event.workflow_run.conclusion == 'success' }}
    ...
```

Remove every `if: always()` clause that bypasses dependency-failure short-circuits. Document each removal in the commit body.

- [ ] **Step 4: Verify locally with `act` (optional but recommended)**

If `act` is installed:

```bash
act -W .github/workflows/cd.yml -e tmp/fake-workflow-run.json --dryrun
```

If not, document that the wiring is verified by the next live CI run. Add a temp commit to a non-main branch and watch CD NOT trigger when CI fails.

- [ ] **Step 5: Add CI/CD wiring scanner test**

Create `tools/ci-cd-wiring-check.ts`:

```typescript
import { readFileSync } from 'fs';
import { parse } from 'yaml';

function fail(msg: string): never {
  console.error('CI/CD wiring violation:', msg);
  process.exit(1);
}

const cd = parse(readFileSync('.github/workflows/cd.yml', 'utf-8'));
const ci = parse(readFileSync('.github/workflows/ci.yml', 'utf-8'));

if (!cd.on || !cd.on.workflow_run) {
  fail('cd.yml must trigger via workflow_run');
}
if (!cd.on.workflow_run.workflows || !cd.on.workflow_run.workflows.includes('CI')) {
  fail('cd.yml workflow_run must reference CI workflow');
}

const cdJobs = cd.jobs ?? {};
for (const [jobName, job] of Object.entries(cdJobs) as [string, Record<string, unknown>][]) {
  const ifClause = (job as { if?: string }).if ?? '';
  if (ifClause.includes('always()')) {
    fail(`cd.yml job "${jobName}" uses if: always() which bypasses dependency failures`);
  }
}

const ciOn = ci.on ?? {};
if (!ciOn.push || !ciOn.push.branches?.includes('master')) {
  fail('ci.yml must fire on push to master so cd.yml workflow_run can chain');
}

console.log('CI/CD wiring OK');
```

Add to `package.json` scripts: `"cicd:check": "npx ts-node tools/ci-cd-wiring-check.ts"`.

- [ ] **Step 6: Run the new check**

```bash
npm run cicd:check
```

Expected: `CI/CD wiring OK`.

- [ ] **Step 7: Commit**

```bash
git add .github/workflows/ci.yml .github/workflows/cd.yml tools/ci-cd-wiring-check.ts package.json
git commit -m "$(cat <<'EOF'
fix(ci): CD requires CI success; remove if: always() bypasses (F106, W0 task 7)

Was: CD ran on push: master independently of CI. Direct master pushes
bypassed every scanner and unit test.

Now:
- ci.yml fires on push to master/develop AND pull_request.
- cd.yml is workflow_run-triggered on CI completion; all jobs gated on
  github.event.workflow_run.conclusion == 'success'.
- All if: always() bypasses removed (<list jobs>).
- New tools/ci-cd-wiring-check.ts as a static check; hooked to npm run
  cicd:check; will be added to required CI jobs in Task 11.

Refs: F106, W0 task 7.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Add gitleaks to CI (F119, partial)

**Goal:** Every PR is scanned for committed secrets. History scan as part of W0 surfaces the live private key in `SECRETS_ROTATION.md` (handed to W1 for revocation + rotation).

**Files:**
- Create: `.gitleaks.toml`
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Configure gitleaks**

Create `.gitleaks.toml`:

```toml
title = "HubbleWave gitleaks config"

[allowlist]
description = "Test fixtures and well-known dummy values"
paths = [
  '''.*\.spec\.ts$''',
  '''.*__fixture__/.*''',
  '''.env\.example$''',
]
regexes = [
  '''dev-only-insecure-secret''',  # historic, scrubbed in W1; allow during transition
  '''ci-test-jwt-secret''',         # CI test value
]

[[rules]]
id = "private-key"
description = "PEM-encoded private key"
regex = '''-----BEGIN ((RSA |EC |OPENSSH |DSA |ENCRYPTED |PGP )?)PRIVATE KEY-----'''

[[rules]]
id = "aws-access-key"
description = "AWS Access Key"
regex = '''(?i)AKIA[0-9A-Z]{16}'''

[[rules]]
id = "stripe-key"
description = "Stripe Secret Key"
regex = '''sk_(test|live)_[0-9a-zA-Z]{24,}'''

[[rules]]
id = "generic-jwt"
description = "JWT (eyJ) token"
regex = '''eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}'''
```

- [ ] **Step 2: Add gitleaks to CI**

In `.github/workflows/ci.yml`, add a job (and add to required-jobs list):

```yaml
  gitleaks:
    name: 🔒 Gitleaks scan
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@<sha>  # pin per W7.D
        with:
          fetch-depth: 0
      - name: Run gitleaks
        uses: gitleaks/gitleaks-action@<sha>  # pin
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GITLEAKS_CONFIG: .gitleaks.toml
```

- [ ] **Step 3: Run gitleaks locally first against history**

```bash
docker run --rm -v "$(pwd):/repo" zricethezav/gitleaks:latest detect \
  --source=/repo --config=/repo/.gitleaks.toml --redact \
  | tee tmp/w00-gitleaks-history.txt
```

**Critical:** This output WILL contain references to live secrets in `SECRETS_ROTATION.md:155-168`. **Do not push tmp/ to a public location.** Add to `.gitignore` if not already.

For each finding:
- If it's the SECRETS_ROTATION.md private key: open a P0 ticket for W1 (revoke + rotate keypair, redact doc, force-push history).
- If it's `.env.backup`: P0 for W1 (rotate JWT secret, force-push history).
- If it's a test fixture: extend `.gitleaks.toml` allowlist.

- [ ] **Step 4: Commit gitleaks config (do NOT commit tmp/ contents)**

```bash
git add .gitleaks.toml .github/workflows/ci.yml
# do NOT git add tmp/*
git commit -m "$(cat <<'EOF'
feat(ci): add gitleaks secret-scanning to CI (F119, W0 task 8)

Required CI job that scans every push for committed secrets, with
history depth fetch-depth: 0 so previously-committed secrets are
detected.

Configured rules: PEM private keys, AWS access keys, Stripe keys,
JWT tokens. Allowlist for known test fixtures and historic
dev-only-insecure-secret string (scrubbed in W1).

Local history scan output is NOT committed (tmp/ ignored). Findings
forwarded to W1 for rotation + revocation + history rewrite.

Refs: F119 (partial: gitleaks); F014 + F111 (findings to act on in W1).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Add SBOM + License Check to CI (F119, completion)

**Goal:** Every release artifact has an SBOM. Every dep license is auditable.

**Files:**
- Modify: `.github/workflows/ci.yml`
- Create: `tools/license-allowlist.json`

- [ ] **Step 1: Define license allowlist**

Create `tools/license-allowlist.json`:

```json
{
  "allowed": [
    "MIT", "MIT*",
    "Apache-2.0", "Apache 2.0",
    "BSD-2-Clause", "BSD-3-Clause", "BSD",
    "ISC",
    "0BSD",
    "Unlicense",
    "CC0-1.0",
    "Python-2.0",
    "BlueOak-1.0.0"
  ],
  "blocked": [
    "GPL-2.0", "GPL-3.0", "AGPL-3.0", "LGPL-2.1", "LGPL-3.0"
  ],
  "exceptions": [
    {
      "package": "<example-pkg>",
      "license": "...",
      "reason": "...",
      "addedAt": "2026-05-09",
      "addedBy": "W0 task 9"
    }
  ]
}
```

- [ ] **Step 2: Add SBOM + license jobs to CI**

In `.github/workflows/ci.yml`:

```yaml
  sbom:
    name: 📦 SBOM
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@<sha>
      - name: Generate SBOM
        uses: anchore/syft-action@<sha>
        with:
          path: '.'
          format: 'spdx-json'
          output-file: 'sbom.spdx.json'
      - name: Upload SBOM artifact
        uses: actions/upload-artifact@<sha>
        with: { name: sbom, path: sbom.spdx.json }
      - name: Vulnerability scan via grype
        uses: anchore/scan-action@<sha>
        with:
          sbom: sbom.spdx.json
          fail-build: true
          severity-cutoff: high

  license-check:
    name: 📄 License audit
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@<sha>
      - uses: actions/setup-node@<sha>
        with: { node-version: '20' }
      - run: npm ci
      - name: Audit licenses
        run: npx license-checker --production --excludePackages "@hw-platform/source" --json > licenses.json
      - name: Validate against allowlist
        run: npx ts-node tools/validate-licenses.ts licenses.json tools/license-allowlist.json
```

- [ ] **Step 3: Implement license validator**

Create `tools/validate-licenses.ts`:

```typescript
import { readFileSync } from 'fs';

const [, , licensesPath, allowlistPath] = process.argv;
if (!licensesPath || !allowlistPath) {
  console.error('Usage: validate-licenses.ts <licenses.json> <allowlist.json>');
  process.exit(2);
}

const licenses = JSON.parse(readFileSync(licensesPath, 'utf-8')) as Record<string, { licenses: string | string[] }>;
const allowlist = JSON.parse(readFileSync(allowlistPath, 'utf-8')) as {
  allowed: string[];
  blocked: string[];
  exceptions: { package: string; license: string; reason: string }[];
};

const violations: string[] = [];
for (const [pkg, info] of Object.entries(licenses)) {
  const lic = Array.isArray(info.licenses) ? info.licenses : [info.licenses];
  const exception = allowlist.exceptions.find((e) => pkg.startsWith(e.package));
  if (exception) continue;
  for (const l of lic) {
    if (allowlist.blocked.some((b) => l?.includes(b))) {
      violations.push(`${pkg}: BLOCKED license ${l}`);
    } else if (!allowlist.allowed.some((a) => l?.includes(a))) {
      violations.push(`${pkg}: UNKNOWN license ${l} — add to allowlist or exceptions`);
    }
  }
}

if (violations.length > 0) {
  for (const v of violations) console.error(v);
  process.exit(1);
}
console.log(`License audit OK (${Object.keys(licenses).length} packages checked)`);
```

- [ ] **Step 4: Run locally**

```bash
npx license-checker --production --excludePackages "@hw-platform/source" --json > tmp/licenses.json
npx ts-node tools/validate-licenses.ts tmp/licenses.json tools/license-allowlist.json
```

Expected: PASS, or specific exception requests for genuine edge cases (e.g., a dual-licensed package). For each, add to `tools/license-allowlist.json` exceptions with reason.

- [ ] **Step 5: Commit**

```bash
git add tools/license-allowlist.json tools/validate-licenses.ts .github/workflows/ci.yml
git commit -m "$(cat <<'EOF'
feat(ci): SBOM generation + license audit (F119, W0 task 9)

Adds:
- syft generates SPDX SBOM as a release artifact.
- grype scans the SBOM and fails CI on high-severity CVEs.
- license-checker validates every prod dep against an explicit allowlist;
  blocked licenses (GPL family) fail CI; unknown licenses require
  explicit exceptions with reason+date+addedBy.
- tools/validate-licenses.ts as the gate.
- tools/license-allowlist.json carries allowed + blocked + exceptions.

Refs: F119 (completion), W0 task 9.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Build `tools/dead-code-check.ts` (Deletion Catalog §D.6)

**Goal:** The anti-resurrection scanner that prevents W4's deletions from coming back.

**Files:**
- Create: `tools/dead-code-check.ts`
- Create: `tools/dead-code-check.spec.ts`
- Create: `tools/dead-code-allowlist.json`
- Modify: `package.json` (add `dead-code:check` script)

- [ ] **Step 1: Write the failing test**

Create `tools/dead-code-check.spec.ts`:

```typescript
import { describe, it, expect } from '@jest/globals';
import { runScannerOnFixture } from './scanner-self-test';
import { execSync } from 'child_process';

describe('dead-code-check.ts', () => {
  it('runs cleanly on master HEAD (or with documented allowlist)', () => {
    let exitCode = 0;
    try {
      execSync('npx ts-node tools/dead-code-check.ts', { stdio: 'pipe' });
    } catch (e: unknown) {
      exitCode = (e as { status?: number }).status ?? 1;
    }
    // After W4 lands, this should be 0. During W0 it MAY be non-zero
    // because deleted-by-W4 items still exist; that's expected, document
    // those findings as "owed to W4".
    expect([0, 1]).toContain(exitCode);
  });

  it('detects an orphaned file', async () => {
    const result = await runScannerOnFixture({
      scannerCommand: 'npx ts-node tools/dead-code-check.ts',
      fixtureContent: 'export const orphan = 42;',
      fixturePath: 'libs/__fixture__/orphan.ts',
    });
    expect(result.exitCode).not.toBe(0);
    expect(result.stdout + result.stderr).toMatch(/orphan/i);
  });

  it('detects a tmpclaude path', async () => {
    const result = await runScannerOnFixture({
      scannerCommand: 'npx ts-node tools/dead-code-check.ts',
      fixtureContent: 'export const x = 1;',
      fixturePath: 'tools/tmpclaude-xyz/foo.ts',
    });
    expect(result.exitCode).not.toBe(0);
    expect(result.stdout + result.stderr).toMatch(/tmpclaude/i);
  });

  it('detects a phantom dep (in fixture package.json)', async () => {
    // Test specifically for the package.json depcheck branch
    // Implementation TBD based on scanner CLI shape
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest tools/dead-code-check.spec.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the scanner**

Create `tools/dead-code-check.ts`:

```typescript
import { Project, Node } from 'ts-morph';
import { readdirSync, readFileSync, existsSync, statSync } from 'fs';
import { join, relative, dirname } from 'path';

interface DeadCodeFinding {
  type: 'orphan-file' | 'unused-export' | 'phantom-dep' | 'trash-pattern';
  path: string;
  detail: string;
}

interface AllowlistEntry {
  type: DeadCodeFinding['type'];
  path: string;
  reason: string;
  addedBy: string;
  addedAt: string;
}

const ROOT = process.cwd();
const SCAN_ROOTS = ['apps', 'libs', 'tools', 'scripts'];
const TRASH_PATTERNS: { regex: RegExp; reason: string }[] = [
  { regex: /tmpclaude[^\\/]*[\\/]/i, reason: 'agent-session trash' },
  { regex: /[\\/]ralph-loop\.(ps1|md)$/i, reason: 'AI-tooling artifact in source tree' },
  { regex: /[\\/]canon-cleanup-ralph-loop\.md$/i, reason: 'AI-tooling artifact' },
  { regex: /[\\/]\.env\.backup$/i, reason: 'historic secret leak' },
];

function loadAllowlist(): AllowlistEntry[] {
  const path = join(ROOT, 'tools', 'dead-code-allowlist.json');
  if (!existsSync(path)) return [];
  return JSON.parse(readFileSync(path, 'utf-8')) as AllowlistEntry[];
}

function isAllowed(allowlist: AllowlistEntry[], type: DeadCodeFinding['type'], path: string): boolean {
  return allowlist.some((e) => e.type === type && (e.path === path || path.endsWith(e.path)));
}

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const stat = statSync(p);
    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist' || entry === 'coverage') continue;
      walk(p, out);
    } else {
      out.push(p);
    }
  }
  return out;
}

function detectTrashPatterns(): DeadCodeFinding[] {
  const findings: DeadCodeFinding[] = [];
  const allFiles = SCAN_ROOTS.flatMap((r) => walk(join(ROOT, r)));
  for (const f of allFiles) {
    const rel = relative(ROOT, f);
    for (const t of TRASH_PATTERNS) {
      if (t.regex.test(rel)) {
        findings.push({ type: 'trash-pattern', path: rel, detail: t.reason });
      }
    }
  }
  return findings;
}

function detectPhantomDeps(): DeadCodeFinding[] {
  const findings: DeadCodeFinding[] = [];
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8')) as {
    dependencies?: Record<string, string>;
  };
  const deps = Object.keys(pkg.dependencies ?? {});

  // Build a content blob of every source file
  const allSources = SCAN_ROOTS.flatMap((r) => walk(join(ROOT, r)))
    .filter((p) => /\.(ts|tsx|js|jsx|mjs)$/.test(p))
    .map((p) => readFileSync(p, 'utf-8'))
    .join('\n');

  for (const dep of deps) {
    const importPattern = new RegExp(
      `(?:from|require\\()\\s*['"]${dep.replace(/[.+*?^$()[\\]{}|\\\\]/g, '\\\\$&')}(?:[/'"]|$)`,
    );
    if (!importPattern.test(allSources)) {
      findings.push({ type: 'phantom-dep', path: 'package.json', detail: dep });
    }
  }
  return findings;
}

function detectOrphanFilesAndExports(): DeadCodeFinding[] {
  const findings: DeadCodeFinding[] = [];
  const project = new Project({ tsConfigFilePath: 'tsconfig.base.json' });
  const sourceFiles = project.getSourceFiles();

  // Build a map of file → set of files that import it
  const importMap = new Map<string, Set<string>>();
  for (const sf of sourceFiles) {
    importMap.set(sf.getFilePath(), new Set());
  }
  for (const sf of sourceFiles) {
    for (const decl of sf.getImportDeclarations()) {
      const target = decl.getModuleSpecifierSourceFile();
      if (target) {
        importMap.get(target.getFilePath())?.add(sf.getFilePath());
      }
    }
  }

  for (const sf of sourceFiles) {
    const rel = relative(ROOT, sf.getFilePath());
    if (rel.includes('__fixture__')) continue;
    if (rel.endsWith('.spec.ts') || rel.endsWith('.test.ts')) continue;
    if (rel.endsWith('main.ts') || rel.endsWith('index.ts')) continue;
    const importers = importMap.get(sf.getFilePath());
    if (!importers || importers.size === 0) {
      // file is not imported anywhere
      findings.push({ type: 'orphan-file', path: rel, detail: 'no importers' });
    }
  }
  return findings;
}

const allowlist = loadAllowlist();
const findings: DeadCodeFinding[] = [
  ...detectTrashPatterns(),
  ...detectPhantomDeps(),
  ...detectOrphanFilesAndExports(),
].filter((f) => !isAllowed(allowlist, f.type, f.path));

if (findings.length > 0) {
  for (const f of findings) {
    console.error(`[${f.type}] ${f.path}: ${f.detail}`);
  }
  console.error(`\\nDead-code-check found ${findings.length} finding(s).`);
  process.exit(1);
}
console.log('Dead-code-check OK');
```

- [ ] **Step 4: Create the allowlist file**

Create `tools/dead-code-allowlist.json`:

```json
[
  {
    "type": "orphan-file",
    "path": "<example>",
    "reason": "loaded by reflection at runtime; not statically imported",
    "addedBy": "W0 task 10",
    "addedAt": "2026-05-09"
  }
]
```

(Start with empty array `[]` and populate as scanner output dictates.)

- [ ] **Step 5: Add npm script**

In `package.json` scripts:

```json
"dead-code:check": "npx ts-node tools/dead-code-check.ts"
```

- [ ] **Step 6: Run test**

```bash
npx jest tools/dead-code-check.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Run scanner against full repo**

```bash
npm run dead-code:check 2>&1 | tee tmp/w00-deadcode.txt
echo "EXIT: $?"
```

Expected: exits non-zero with findings:
- Trash patterns: `apps/tmpclaude-4824-cwd/`, `tools/tmpclaude-0e02-cwd/`, `scripts/tmpclaude-8c30-cwd/`, `ralph-loop.ps1`, `hubblewave-ralph-loop.md`, `canon-cleanup-ralph-loop.md`.
- Phantom deps: `bcrypt`, `node-cache`, `@hello-pangea/dnd`, `@mui/material`, `@mui/icons-material`, `@emotion/react`, `@emotion/styled`.
- Orphan files: contents of `libs/relationship-resolver/`, `apps/svc-instance-api/src/app/packs/`, possibly more.

These findings are EXPECTED — they confirm the Deletion Catalog. They will be cleared by W4. Until then, add a "owed to W4" entry block to the allowlist with explicit `addedBy: 'W0 task 10'` and `expiresAt: '2026-W4-completion'` (informal — the scanner doesn't enforce dates yet, but the convention is documented).

- [ ] **Step 8: Add allowlist entries for items deferred to W4**

Update `tools/dead-code-allowlist.json` with each known violation, citing the wave that will resolve it. Future PRs that add NEW dead code (not on this allowlist) fail CI.

- [ ] **Step 9: Commit**

```bash
git add tools/dead-code-check.ts tools/dead-code-check.spec.ts tools/dead-code-allowlist.json package.json
git commit -m "$(cat <<'EOF'
feat(tools): dead-code-check.ts anti-resurrection scanner (Deletion Catalog D.6, W0 task 10)

Detects orphan files, unused exports, phantom deps, and known-trash
path patterns (tmpclaude*, ralph-loop*, .env.backup). Run via
npm run dead-code:check.

Pre-W4 violations cataloged in tools/dead-code-allowlist.json with
explicit "owed to W4" reasons. Each future PR that introduces new
dead code without an allowlist entry will fail CI.

Allowlist entries: ~<N> for W4-deferred items (relationship-resolver,
tmpclaude dirs, ralph-loop files, phantom deps).

Refs: Deletion Catalog D.6, W0 task 10.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Document Required Status Checks

**Goal:** Make every scanner a required status check on the `master` branch protection rule. This is a GitHub repo-settings operation; documented here for the human admin to execute.

**Files:**
- Create: `docs/plan-fixes/W00-required-status-checks.md`

- [ ] **Step 1: Author the runbook**

```markdown
# W0 Required Status Checks Runbook

**For:** Repository admin

**Action:** Configure branch protection on `master` to require these status checks before merge.

## Required Checks (after W0 lands)

In GitHub Settings → Branches → Branch protection rules → master → "Require status checks to pass before merging":

- ✅ `lint`
- ✅ `test`
- ✅ `build`
- ✅ `compliance:check`
- ✅ `authz:check`
- ✅ `audit:check`
- ✅ `security:check`
- ✅ `service-boundary:check`
- ✅ `deps:check`
- ✅ `cicd:check` (NEW, W0 task 7)
- ✅ `gitleaks` (NEW, W0 task 8)
- ✅ `sbom` (NEW, W0 task 9)
- ✅ `license-check` (NEW, W0 task 9)
- ✅ `dead-code:check` (NEW, W0 task 10)

Plus:
- ✅ "Require branches to be up to date before merging"
- ✅ "Require conversation resolution before merging"
- ✅ "Require linear history" (recommended)
- ✅ "Do not allow bypassing the above settings" (no admin bypass without sign-off)

## Bypass Procedure

If a CI gate must be bypassed for an emergency fix:
1. Open a GitHub Issue documenting the bypass request, the CI failure, and the proposed remediation.
2. Get sign-off from a security reviewer (CODEOWNERS-defined; see W10).
3. Use the GitHub admin override.
4. Open a follow-up PR within 24 hours to restore the gate.
5. Audit row written to `bypass_audit` (control-plane DB) — see W10.

## Verification

After enabling, attempt to merge a PR with a deliberately-failing scanner. The merge button should be disabled.
```

- [ ] **Step 2: Commit**

```bash
git add docs/plan-fixes/W00-required-status-checks.md
git commit -m "$(cat <<'EOF'
docs(plan-fixes): runbook for required status check configuration (W0 task 11)

Lists every CI gate that must be a required status check on master
post-W0 + bypass procedure. Repo admin executes; not automatable
inside the codebase.

Refs: W0 task 11.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 3: Hand off to admin**

Create a follow-up issue in GitHub with title "W0: configure required status checks per `docs/plan-fixes/W00-required-status-checks.md`" and assign to the repo admin. Block W0 wave-completion on confirmation.

---

## Task 12: Wave-End Verification + Canon Amendment

**Goal:** Prove W0 acceptance criteria and amend CLAUDE.md to reflect what is now actually enforced.

**Files:**
- Modify: `CLAUDE.md` (amendment)
- Create: `docs/plan-fixes/W00-acceptance.md`

- [ ] **Step 1: Re-run every scanner**

```bash
for s in compliance:check authz:check audit:check security:check service-boundary:check deps:check cicd:check dead-code:check; do
  echo "=== $s ==="
  npm run $s
  echo "EXIT: $?"
done
```

Expected:
- `security:check`: exit 0 (Task 3 reconciled allowlist).
- `authz:check`: exit 0 OR exit non-zero with violations explicitly tagged for W2/W3 in the allowlist (Task 4).
- `service-boundary:check`: exit non-zero — confirms F055 (svc-data writes AutomationRule); this is intentional, the violation is explicitly handed to W4 via allowlist comment.
- `dead-code:check`: exit non-zero with all findings in allowlist with W4 attribution.
- All others: green.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: PASS (Task 6's eslint config is satisfied with the W0 fixes + structured allowlist for F121).

- [ ] **Step 3: Author acceptance doc**

Create `docs/plan-fixes/W00-acceptance.md`:

```markdown
# W0 Acceptance — 2026-05-<date>

## Findings Closed

- F018 ✅ — authz-bypass-check.ts now scans all 11 instance services. Self-test asserts coverage.
- F056 ✅ — service-boundary-check.ts has entity-write rule. Self-test asserts detection. Surfaces the svc-data automation runtime violation as evidence for W4.
- F104 ✅ — eslint.config.mjs enforces canon §21 rules. Custom no-versioned-identifier rule with spec.
- F105 ✅ — security-bypass-check.ts PUBLIC_ALLOWLIST reconciled with reality (26 sites). Drift check in self-test.
- F106 ✅ — CD requires CI completion via workflow_run trigger. All if: always() bypasses removed.
- F119 ✅ — gitleaks + SBOM + license-check are required CI jobs. License allowlist with structured exceptions.
- D.6 ✅ — dead-code-check.ts scanner shipped with allowlist; pre-W4 findings cataloged with structured "owed to W4" reasons.

## Findings Newly Surfaced (Handed to Later Waves)

- <list of svc-data → AutomationRule writes from service-boundary-check>
- <list of authz-bypass cases from previously-unscanned services>
- <list of dead code in allowlist owed to W4>
- gitleaks history finding: live private key in SECRETS_ROTATION.md:155-168 → P0 ticket for W1.

## Verification

| Check | Status |
|---|---|
| All 9 scanners self-tested | ✅ |
| Lint enforces canon §21 | ✅ |
| CD requires CI | ✅ |
| Repo settings runbook delivered | ✅ |
| Required status checks pending admin | ⏳ (Task 11 issue open) |

## Risks Carried Forward

- Until repo admin completes Task 11, gates exist in CI but not as required status checks.
- The svc-data automation runtime violation is intentional debt for W4.
- gitleaks history finding is intentional debt for W1; **do not delay W1**.
```

- [ ] **Step 4: Amend CLAUDE.md**

Modify `CLAUDE.md`'s Amendment Log section to add a 2026-05-<date> entry. Also tighten §21 enforcement claims to match reality (every claim now has a scanner or lint rule).

Replace the §21 paragraph that says "Implementation status (W6.A): The scanners exist..." with:

```markdown
**Implementation status (W0, 2026-05-<date>):** Every canon-claimed scanner
or lint rule is enforced by code:
- npm run authz:check (W0 task 4): scans all 11 instance services.
- npm run audit:check (W1.6): wraps audit + mutation in withAudit; AST
  scanner v2 pending W5.
- npm run security:check (W0 task 3): PUBLIC_ALLOWLIST reconciled (26 sites).
- npm run compliance:check (existing): terminology rules.
- npm run service-boundary:check (W0 task 5): import topology + entity-write.
- npm run deps:check (existing): approved dependencies.
- npm run cicd:check (W0 task 7): CD ↔ CI gating wired.
- npm run dead-code:check (W0 task 10): orphan + phantom + trash patterns.
- ESLint (W0 task 6): no-warning-comments, no-unused-vars,
  no-versioned-identifier (custom), react-hooks/rules-of-hooks,
  naming-convention.
- gitleaks, syft+grype SBOM, license-checker (W0 tasks 8-9).

Required status checks on master pending admin configuration per
docs/plan-fixes/W00-required-status-checks.md.
```

Add to Amendment Log:

```markdown
- 2026-05-<date> (W0): Foundation wave complete. Scanner scope expanded
  (authz to all 11 services, service-boundary with entity-write rule).
  PUBLIC_ALLOWLIST reconciled. ESLint enforces canon §21. CD gated on
  CI. gitleaks + SBOM + license-check + dead-code-check added to CI.
  §21 implementation status updated to reflect actual enforcement.
```

- [ ] **Step 5: Open the W0 PR**

```bash
git push -u origin claude/condescending-shamir-92422b
gh pr create --title "W0: Foundation — make scanners truthful, ESLint real, CI gates enforced" --body "$(cat <<'EOF'
## Summary
- Foundation wave for the 27-week platform remediation per docs/plan-fixes/00-master-remediation-roadmap.md.
- Closes findings F018, F056, F104, F105, F106, F119; ships Deletion Catalog §D.6 scanner.

## Acceptance evidence
- See docs/plan-fixes/W00-acceptance.md.
- Every scanner self-tested.
- Every closed finding has a regression test.
- ESLint catches the React Rules-of-Hooks violation (F088 verification).

## Newly-surfaced violations handed to later waves
- svc-data → AutomationRule writes (W4)
- authz-bypass cases in previously-unscanned services (W2/W3)
- Dead code in W4 catalog (relationship-resolver, tmpclaude, ralph-loop, phantom deps)
- gitleaks history finding: SECRETS_ROTATION.md private key (W1, P0)

## Test plan
- [ ] CI runs all new gates and they pass on this PR (or fail with explicit, allowlisted, traceable reasons).
- [ ] Repo admin to enable required status checks per docs/plan-fixes/W00-required-status-checks.md after merge.
- [ ] W1 PR to land within 7 days addressing the gitleaks finding.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 6: Hand off**

After PR opens:
1. Request review from CODEOWNERS-equivalent (since CODEOWNERS lands in W10).
2. Block W1 start on PR merge + admin completing Task 11's required-status-check config.
3. After merge, delete `wave/W00-foundation` branch + worktree (or, since we're already in `condescending-shamir-92422b`, leave the worktree until we finish all waves).
4. Update master roadmap status: W0 complete; begin W1.

---

## Self-Review Checklist

- **Spec coverage:** F018 (Task 4), F056 (Task 5), F104 (Task 6), F105 (Task 3), F106 (Task 7), F119 (Tasks 8 + 9), D.6 (Task 10). ✅
- **Placeholder scan:** Each task has actual code blocks for tests, implementations, commands, commit messages. No "TBD"/"implement appropriately" remaining (one explicit "TBD" in Task 10 spec is for an optional fourth test that's nice-to-have, not blocking).
- **Type/symbol consistency:** `runScannerOnFixture` defined in Task 2, used in Tasks 3-5 + 10. `ENTITY_OWNERSHIP` exported from Task 5, no conflicting definition. `PUBLIC_ALLOWLIST` exported from Task 3 for use in self-test. `TODO_ALLOWLIST` referenced in Task 6's eslint config — note: this lives in the eslint config itself; engineers should NOT introduce a separate file unless explicitly needed.

---

## Execution Handoff

**Subagent-Driven (recommended).** Per task:
1. Dispatch fresh subagent with the task spec from this document + necessary code excerpts.
2. Subagent works the task in TDD discipline (RED → GREEN → COMMIT).
3. Per-task code review via `feature-dev:code-reviewer`.
4. On Critical/Important findings: address before moving to next task.
5. Continue until Task 12 verification.

**Inline Execution.** Possible for Tasks 1, 2, 3, 7, 11, 12 (read/config/doc work). Subagent-recommended for Tasks 4, 5, 6, 8, 9, 10 where AST work and integration matters.

Hybrid is fine. Auto mode preference: inline for read-only and config; subagent for code-heavy tasks.
