# Phase 3 Prelude Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore a deterministic runtime baseline before Phase 3 W2 starts. Complete the schema split, remove every Phase 1/2 compatibility shim, delete obsolete product surfaces, and lock validation harness + scanners as permanent CI gates.

**Architecture:** Four streams executed in dependency order (Schema Model Finalization → Compatibility Shim Removal → Obsolete Product Surface Removal → Validation Harness). Each stream is further decomposed into four task categories — **Mechanical**, **Architectural Validation**, **Destructive Cleanup**, **CI / Scanner** — per founder mandate. Stream 1 lands as an atomic commit (entities + migration commits + search_path removal validated together). Stream 3 has a user-approval gate before any deletion executes. Every commit uses the `phase3-prelude:` prefix.

**Tech Stack:** TypeScript, NestJS (apps/api, apps/control-plane), TypeORM, PostgreSQL with domain schemas (identity, metadata, automation, ava, notify, integrations, insights, app_builder), Nx workspace, Vite (web-client), GitHub Actions (CI). Scanners are tsx-executed TypeScript files under `tools/scanners/`.

**Governing spec:** `docs/superpowers/specs/2026-05-14-phase3-roadmap-and-prelude-design.md` (commit `09d654a`).

**Prelude Freeze Rule (binding):** No new feature development lands during Prelude except fixes required to complete Prelude exit criteria. Non-Prelude PRs are labeled `prelude-freeze-queued` and held.

**Preservation boundaries (binding):** Existing canonical API contracts, approved Phase 2 auth/identity/audit architecture, modular monolith topology, W2–W5 sequencing assumptions — all preserved unless escalated for explicit founder approval per the cross-wave rule.

---

## Pre-Flight: Working tree audit

Before Stream 1 starts, capture the current working tree so we know which uncommitted smoke fixes from 2026-05-14 belong to Prelude scope vs. which carry forward as Prelude tasks. This is a one-time audit, not a stream.

### Task 0: Working tree inventory

**Files:**
- Read: `git status --short`, `git diff --stat`

- [ ] **Step 1: Capture current uncommitted state**

Run:
```
cd "C:/Dev/HW-Platform/HW Platform" && git status --short
```

Expected output: lists 7 modified files from smoke testing + untracked schema migrations (`1940*-1942*`) + untracked `apps/svc-*` directories.

- [ ] **Step 2: Classify each modified file**

Match each modification against the following:
- `apps/web-client/vite.config.mts` → **real fix** (proxy retarget at monolith); commits in Task 16.
- `apps/api/src/app/metadata/access/access.module.ts` → **real fix** (AuthModule out of forFeature); commits in Task 16.
- `scripts/seed-admin-user.ts` → **real fix** (schema-qualified RBAC tables); commits in Task 16.
- `libs/instance-db/src/lib/instance-db.module.ts` → **bridge** (`search_path`); removed in Task 9.
- `apps/api/src/app/identity/identity.module.ts` → **locked direction** (AbacGuard removed from APP_GUARD); commits in Task 18.
- `apps/api/src/app/identity/auth/guards/permissions.guard.ts` → **duplicate; deleted** in Task 17.
- `libs/auth-guard/src/lib/permissions.guard.ts` → **locked direction** (canonical warn-and-allow); commits in Task 17.

- [ ] **Step 3: Confirm untracked state**

The following must exist as untracked:
- `migrations/instance/1940000000000-notify-schema.ts` through `1942000000000-cross-domain-read-diff-table.ts` (11 files)
- `apps/svc-*` directories (11 leftover dirs from Phase 1 deletions)

No commit yet — audit only. The next task starts Stream 1.

---

## Stream 1 — Schema Model Finalization

**Stream goal:** Complete the schema split so every entity declares its owning domain schema; commit the previously-untracked `1940*-1942*` migrations; remove the `search_path` bridge from `instance-db.module.ts` atomically with the entity updates.

**Stream exit gate:** empty DB → `npm run migration:run:instance` → no errors → every domain schema present → every entity's runtime query targets its declared schema → all three new scanners pass → migration filename scanner passes.

**Decomposition (per founder mandate):**
- Tasks 1–4 are **CI / Scanner** (scanner creation, written BEFORE entity edits).
- Tasks 5–6 are **Architectural Validation** (migration audit, schema manifest assembly).
- Tasks 7–8 are **Mechanical** (entity decorator edits per domain).
- Task 9 is **Destructive Cleanup** (search_path bridge removal, atomic commit).
- Task 10 is **Architectural Validation** (Stream 1 exit gate).

### Task 1: Establish `tools/scanners/` directory + allowlist convention

**Files:**
- Create: `tools/scanners/README.md`
- Create: `tools/scanners/allowlist-schema.json`

- [ ] **Step 1: Create `tools/scanners/` directory**

Run:
```
mkdir -p "tools/scanners"
```

- [ ] **Step 2: Write the scanner conventions README**

Create `tools/scanners/README.md` with the conventions locked in the spec:

```markdown
# Scanner Conventions

All scanners under this directory follow these rules:

- Exit non-zero on violation.
- Support CI mode (`--ci`, structured output) + local mode (default, human-readable).
- Emit both machine-readable JSON (`--json` or `--ci`) and human-readable summaries (default).
- Allowlists live alongside the scanner: `tools/scanners/<scanner-name>-allowlist.json`.
- Every allowlist entry requires `rationale`, `addedBy`, `addedAt`. Bare entries fail the scanner.
- Prelude scanners become permanent CI gates unless explicitly retired in a documented spec amendment.

Scanners introduced by Prelude:
- `entity-schema-ownership-check.ts` (Task 2)
- `cross-domain-import-check.ts` (Task 3)
- `migration-filename-check.ts` (Task 4)
- `permissions-annotation-coverage.ts` (Task 19)
- `abac-coverage-check.ts` (Task 20)
```

- [ ] **Step 3: Write the allowlist JSON schema reference**

Create `tools/scanners/allowlist-schema.json`:

```json
{
  "$schema": "https://json-schema.org/draft-07/schema#",
  "title": "Scanner Allowlist Entry",
  "type": "object",
  "required": ["target", "rationale", "addedBy", "addedAt"],
  "properties": {
    "target": { "type": "string", "description": "What is being allowlisted (file path, identifier, etc.)" },
    "rationale": { "type": "string", "description": "Why this exception is acceptable" },
    "addedBy": { "type": "string", "description": "GitHub handle or full name" },
    "addedAt": { "type": "string", "format": "date", "description": "YYYY-MM-DD" },
    "followUp": { "type": "string", "description": "Optional: wave or plan reference for closure" }
  }
}
```

- [ ] **Step 4: Commit**

```
git add tools/scanners/README.md tools/scanners/allowlist-schema.json
git commit -m "phase3-prelude: introduce tools/scanners/ conventions"
```

### Task 2: Author `entity-schema-ownership-check.ts` scanner (TDD)

**Files:**
- Create: `tools/scanners/entity-schema-ownership-check.ts`
- Create: `tools/scanners/entity-schema-ownership-check-selftest.ts`
- Create: `tools/scanners/entity-schema-manifest.json`

**Caveat (documented limitation):** Prelude scanners are intentionally heuristic / static-text-based (regex over `*.entity.ts` files) for implementation speed. They are sufficient for the Prelude exit criterion but may miss edge cases (TS computed property names, conditional `@Entity()` calls, decorators authored in odd whitespace patterns). Future waves may replace these with AST-based parsing (`ts-morph` or `@typescript-eslint/parser`) if false positives/negatives become operationally significant. Do not overtrust regex scanners as architectural truth — they are a CI gate, not a static-analysis guarantee.

- [ ] **Step 1: Build the entity → schema manifest from migration source-of-truth**

Inspect each untracked migration `migrations/instance/1940000000000-notify-schema.ts` through `1940700000000-metadata-schema.ts`. Each migration's `tables` array lists the tables it moved into its named schema. Build a JSON manifest at `tools/scanners/entity-schema-manifest.json`:

```json
{
  "identity": ["roles", "permissions", "role_permissions", "user_roles", "groups", "group_members", "group_roles", "password_policies", "ldap_configs", "sso_providers", "password_history", "password_reset_tokens", "email_verification_tokens", "refresh_tokens", "api_keys", "user_invitations", "mfa_methods", "saml_auth_states", "login_attempts", "webauthn_credentials", "webauthn_challenges", "magic_link_tokens", "trusted_devices", "impersonation_sessions", "delegations", "behavioral_profiles", "security_alerts", "auth_settings", "auth_events", "nav_profiles", "nav_profile_items"],
  "metadata": ["...derived from 1940700000000-metadata-schema.ts..."],
  "automation": ["...derived from 1940300000000-automation-schema.ts..."],
  "ava": ["...derived from 1940200000000-ava-schema.ts..."],
  "notify": ["...derived from 1940000000000-notify-schema.ts..."],
  "integrations": ["...derived from 1940400000000-integrations-schema.ts..."],
  "insights": ["...derived from 1940100000000-insights-schema.ts..."],
  "app_builder": ["...derived from 1940600000000-app-builder-schema.ts..."],
  "public": ["users", "audit_logs", "key_metadata", "service_principals", "instance_event_outbox", "runtime_anomaly", "search_embeddings"]
}
```

The values shown as `"...derived from..."` are placeholders for the actual table arrays — extract them directly from each migration's `tables` field.

- [ ] **Step 2: Write the scanner self-test (TDD: failing test first)**

Create `tools/scanners/entity-schema-ownership-check-selftest.ts`:

```ts
import { execSync } from 'child_process';
import { writeFileSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

function runWithFixture(entityContent: string, manifestContent: string): { code: number; stdout: string } {
  const dir = mkdtempSync(join(tmpdir(), 'entity-scanner-test-'));
  writeFileSync(join(dir, 'test.entity.ts'), entityContent);
  writeFileSync(join(dir, 'manifest.json'), manifestContent);
  try {
    const stdout = execSync(`npx tsx tools/scanners/entity-schema-ownership-check.ts --root=${dir} --manifest=${join(dir, 'manifest.json')}`, { encoding: 'utf8' });
    return { code: 0, stdout };
  } catch (e: any) {
    return { code: e.status ?? 1, stdout: e.stdout?.toString() ?? '' };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const manifest = JSON.stringify({ identity: ['users'], public: ['key_metadata'] });

// Fail: entity for table in `identity` schema declares no schema
const noSchema = `@Entity('users') export class User {}`;
const r1 = runWithFixture(noSchema, manifest);
console.assert(r1.code !== 0, 'Should fail when schema missing for identity table');

// Fail: entity declares wrong schema
const wrongSchema = `@Entity({ name: 'users', schema: 'metadata' }) export class User {}`;
const r2 = runWithFixture(wrongSchema, manifest);
console.assert(r2.code !== 0, 'Should fail when schema is wrong for table');

// Pass: entity declares correct schema
const correctSchema = `@Entity({ name: 'users', schema: 'identity' }) export class User {}`;
const r3 = runWithFixture(correctSchema, manifest);
console.assert(r3.code === 0, 'Should pass when schema matches manifest');

// Pass: entity for public-schema table declares no schema (public is default)
const publicNoSchema = `@Entity('key_metadata') export class KeyMetadata {}`;
const r4 = runWithFixture(publicNoSchema, manifest);
console.assert(r4.code === 0, 'Should pass when table is in public and no schema declared');

console.log('entity-schema-ownership-check selftest: 4/4 assertions');
```

- [ ] **Step 3: Run self-test to verify it fails (scanner doesn't exist yet)**

Run:
```
npx tsx tools/scanners/entity-schema-ownership-check-selftest.ts
```

Expected: FAIL with "Cannot find module 'tools/scanners/entity-schema-ownership-check.ts'" or similar.

- [ ] **Step 4: Implement the scanner**

Create `tools/scanners/entity-schema-ownership-check.ts`:

```ts
#!/usr/bin/env tsx
/**
 * entity-schema-ownership-check
 *
 * Verifies every `@Entity()` declaration matches the schema assigned to its
 * table by the schema-split migrations (1940*-1942*). The manifest at
 * `tools/scanners/entity-schema-manifest.json` is the source of truth.
 *
 * Failures:
 *   - Entity for a table in a domain schema declares no schema (bare `@Entity('x')`)
 *   - Entity declares a different schema than the manifest assigns
 *
 * Passes:
 *   - Entity declares the correct schema explicitly
 *   - Entity for a `public`-schema table declares no schema (public is TypeORM default)
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

interface Manifest { [schema: string]: string[] }

function parseArgs(argv: string[]): { root: string; manifest: string; ci: boolean } {
  let root = '.';
  let manifest = 'tools/scanners/entity-schema-manifest.json';
  let ci = false;
  for (const arg of argv) {
    if (arg.startsWith('--root=')) root = arg.slice('--root='.length);
    else if (arg.startsWith('--manifest=')) manifest = arg.slice('--manifest='.length);
    else if (arg === '--ci') ci = true;
  }
  return { root, manifest, ci };
}

function findEntityFiles(root: string): string[] {
  const results: string[] = [];
  function walk(dir: string) {
    let entries: string[] = [];
    try { entries = readdirSync(dir); } catch { return; }
    for (const entry of entries) {
      const full = join(dir, entry);
      let stat;
      try { stat = statSync(full); } catch { continue; }
      if (stat.isDirectory()) {
        if (entry === 'node_modules' || entry === 'dist' || entry === '.git') continue;
        walk(full);
      } else if (entry.endsWith('.entity.ts') || full.endsWith('.entity.ts')) {
        results.push(full);
      }
    }
  }
  walk(root);
  return results;
}

interface EntityDecl { file: string; tableName: string; declaredSchema?: string }

function extractEntities(file: string): EntityDecl[] {
  const src = readFileSync(file, 'utf8');
  const results: EntityDecl[] = [];
  // Match @Entity('name') OR @Entity({ name: 'name', schema: 'schema' })
  const re = /@Entity\(\s*(?:'([^']+)'|\{\s*name:\s*'([^']+)'(?:\s*,\s*schema:\s*'([^']+)')?[^}]*\})\s*\)/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const tableName = m[1] ?? m[2];
    const declaredSchema = m[3];
    results.push({ file, tableName, declaredSchema });
  }
  return results;
}

function main() {
  const { root, manifest: manifestPath, ci } = parseArgs(process.argv.slice(2));
  const manifest: Manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const tableToSchema = new Map<string, string>();
  for (const [schema, tables] of Object.entries(manifest)) {
    for (const t of tables) tableToSchema.set(t, schema);
  }
  const files = findEntityFiles(root);
  const violations: { file: string; tableName: string; expected: string; declared: string | undefined }[] = [];
  for (const file of files) {
    for (const decl of extractEntities(file)) {
      const expected = tableToSchema.get(decl.tableName);
      if (!expected) continue; // unknown table — out of manifest scope
      if (expected === 'public') {
        if (decl.declaredSchema && decl.declaredSchema !== 'public') {
          violations.push({ file: decl.file, tableName: decl.tableName, expected, declared: decl.declaredSchema });
        }
      } else {
        if (decl.declaredSchema !== expected) {
          violations.push({ file: decl.file, tableName: decl.tableName, expected, declared: decl.declaredSchema });
        }
      }
    }
  }
  if (ci) {
    console.log(JSON.stringify({ violations, total: violations.length }));
  } else if (violations.length > 0) {
    console.log(`\nEntity schema ownership violations (${violations.length}):\n`);
    for (const v of violations) {
      console.log(`  ${v.file}`);
      console.log(`    table '${v.tableName}' → expected schema '${v.expected}', declared '${v.declared ?? '(none)'}'`);
    }
  } else {
    console.log('entity-schema-ownership-check: 0 violations');
  }
  process.exit(violations.length > 0 ? 1 : 0);
}

main();
```

- [ ] **Step 5: Re-run self-test to verify pass**

Run:
```
npx tsx tools/scanners/entity-schema-ownership-check-selftest.ts
```

Expected: `entity-schema-ownership-check selftest: 4/4 assertions` with exit 0.

- [ ] **Step 6: Run against current codebase**

Run:
```
npx tsx tools/scanners/entity-schema-ownership-check.ts
```

Expected: NON-ZERO exit with a list of ~130 violations — current entities mostly declare no schema. This is the work Task 7 closes.

- [ ] **Step 7: Add `npm run entity-schema:check` script + commit**

Edit `package.json` `scripts`:
```json
"entity-schema:check": "npx tsx tools/scanners/entity-schema-ownership-check.ts",
"selftest:entity-schema": "npx tsx tools/scanners/entity-schema-ownership-check-selftest.ts"
```

Then:
```
git add tools/scanners/entity-schema-ownership-check.ts tools/scanners/entity-schema-ownership-check-selftest.ts tools/scanners/entity-schema-manifest.json package.json
git commit -m "phase3-prelude: introduce entity-schema-ownership scanner"
```

### Task 3: Author `cross-domain-import-check.ts` scanner

**Files:**
- Create: `tools/scanners/cross-domain-import-check.ts`
- Create: `tools/scanners/cross-domain-import-check-selftest.ts`
- Create: `tools/scanners/cross-domain-allowlist.json`

**Caveat (documented limitation):** Same regex/heuristic posture as Task 2 — see Task 2 caveat. Replace with AST parsing in a future wave if false positives/negatives become problematic.

**Allowlist format:** uses **logical identifiers** (`<domain>.<entity-name>`) instead of filesystem paths so that refactors (file moves, renames) don't invalidate entries unnecessarily. Example: `identity.user-role` → `public.user` instead of `libs/instance-db/.../identity/user-role.entity.ts → libs/instance-db/.../public/user.entity.ts`.

- [ ] **Step 1: Build cross-domain ownership map**

Based on the entity manifest from Task 2, an entity file's domain is determined by which schema its `@Entity()` declares. Each entity also has a logical name derived from the class name (kebab-cased), e.g. `UserRole` → `user-role`. The scanner flags any import statement in an entity file that resolves to another domain's entity outside the allowlist.

- [ ] **Step 2: Initialize an empty allowlist**

Create `tools/scanners/cross-domain-allowlist.json`:
```json
{
  "$schema": "./allowlist-schema.json",
  "entries": []
}
```

Each entry, when populated, has the shape:
```json
{
  "from": "identity.user-role",
  "to": "public.user",
  "rationale": "FK to public.users; users intentionally stays in public per schema-split design.",
  "addedBy": "<github-handle>",
  "addedAt": "2026-05-14"
}
```

`from` and `to` are `<domain>.<entity-name>` logical identifiers.

- [ ] **Step 3: Write self-test (TDD)**

Create `tools/scanners/cross-domain-import-check-selftest.ts`:

```ts
import { execSync } from 'child_process';
import { writeFileSync, mkdtempSync, rmSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

function runFixture(setup: (dir: string) => void): { code: number; stdout: string } {
  const dir = mkdtempSync(join(tmpdir(), 'cd-scanner-'));
  setup(dir);
  try {
    const stdout = execSync(`npx tsx tools/scanners/cross-domain-import-check.ts --root=${dir} --manifest=${join(dir, 'manifest.json')} --allowlist=${join(dir, 'allowlist.json')}`, { encoding: 'utf8' });
    return { code: 0, stdout };
  } catch (e: any) {
    return { code: e.status ?? 1, stdout: e.stdout?.toString() ?? '' };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const manifest = JSON.stringify({ identity: ['users'], metadata: ['collections'] });
const emptyAllowlist = JSON.stringify({ entries: [] });

// Fail: identity entity imports metadata entity
const r1 = runFixture((d) => {
  writeFileSync(join(d, 'manifest.json'), manifest);
  writeFileSync(join(d, 'allowlist.json'), emptyAllowlist);
  mkdirSync(join(d, 'identity'));
  mkdirSync(join(d, 'metadata'));
  writeFileSync(join(d, 'identity/user.entity.ts'),
    `import { Collection } from '../metadata/collection.entity';\n@Entity({ name: 'users', schema: 'identity' }) export class User {}`);
  writeFileSync(join(d, 'metadata/collection.entity.ts'),
    `@Entity({ name: 'collections', schema: 'metadata' }) export class Collection {}`);
});
console.assert(r1.code !== 0, 'Should fail when entity imports across domains without allowlist');

// Pass: same-domain import
const r2 = runFixture((d) => {
  writeFileSync(join(d, 'manifest.json'), manifest);
  writeFileSync(join(d, 'allowlist.json'), emptyAllowlist);
  mkdirSync(join(d, 'identity'));
  writeFileSync(join(d, 'identity/user.entity.ts'),
    `@Entity({ name: 'users', schema: 'identity' }) export class User {}`);
});
console.assert(r2.code === 0, 'Should pass when no cross-domain imports');

console.log('cross-domain-import-check selftest: 2/2 assertions');
```

- [ ] **Step 4: Implement scanner**

Create `tools/scanners/cross-domain-import-check.ts`. Walk every `*.entity.ts` file. Extract its logical identifier `<domain>.<entity-name>` (domain from `@Entity({ schema })`; entity-name from kebab-cased class name). For each relative import, resolve the imported file's logical identifier. If the imported entity is in a different domain, check the allowlist by `from`/`to` logical-id pair (NOT by filesystem path). Record violations.

```ts
#!/usr/bin/env tsx
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve, dirname } from 'path';

interface Manifest { [schema: string]: string[] }
interface AllowlistEntry { from: string; to: string; rationale: string; addedBy: string; addedAt: string }
interface Allowlist { entries: AllowlistEntry[] }

function parseArgs(argv: string[]): { root: string; manifest: string; allowlist: string; ci: boolean } {
  let root = '.';
  let manifest = 'tools/scanners/entity-schema-manifest.json';
  let allowlist = 'tools/scanners/cross-domain-allowlist.json';
  let ci = false;
  for (const arg of argv) {
    if (arg.startsWith('--root=')) root = arg.slice('--root='.length);
    else if (arg.startsWith('--manifest=')) manifest = arg.slice('--manifest='.length);
    else if (arg.startsWith('--allowlist=')) allowlist = arg.slice('--allowlist='.length);
    else if (arg === '--ci') ci = true;
  }
  return { root, manifest, allowlist, ci };
}

function findEntityFiles(root: string): string[] {
  const out: string[] = [];
  function walk(dir: string) {
    let entries: string[] = [];
    try { entries = readdirSync(dir); } catch { return; }
    for (const entry of entries) {
      const full = join(dir, entry);
      let stat; try { stat = statSync(full); } catch { continue; }
      if (stat.isDirectory()) {
        if (entry === 'node_modules' || entry === 'dist' || entry === '.git') continue;
        walk(full);
      } else if (entry.endsWith('.entity.ts')) out.push(full);
    }
  }
  walk(root);
  return out;
}

function kebab(s: string): string {
  return s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

interface FileMeta { file: string; domain: string; logicalId: string }

function entityMeta(file: string, tableToSchema: Map<string, string>): FileMeta | null {
  const src = readFileSync(file, 'utf8');
  const entityRe = /@Entity\(\s*(?:'([^']+)'|\{\s*name:\s*'([^']+)'(?:\s*,\s*schema:\s*'([^']+)')?[^}]*\})\s*\)/;
  const classRe = /export\s+class\s+(\w+)/;
  const em = entityRe.exec(src);
  const cm = classRe.exec(src);
  if (!em || !cm) return null;
  const table = em[1] ?? em[2];
  const domain = em[3] ?? tableToSchema.get(table) ?? 'public';
  return { file, domain, logicalId: `${domain}.${kebab(cm[1])}` };
}

function extractImports(file: string): { path: string; line: number }[] {
  const src = readFileSync(file, 'utf8');
  const out: { path: string; line: number }[] = [];
  const re = /import\s+(?:[^'"`]+\s+from\s+)?['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const line = src.slice(0, m.index).split('\n').length;
    out.push({ path: m[1], line });
  }
  return out;
}

function main() {
  const { root, manifest: manifestPath, allowlist: allowlistPath, ci } = parseArgs(process.argv.slice(2));
  const manifest: Manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const tableToSchema = new Map<string, string>();
  for (const [s, ts] of Object.entries(manifest)) for (const t of ts) tableToSchema.set(t, s);
  const allowlist: Allowlist = JSON.parse(readFileSync(allowlistPath, 'utf8'));
  const allowedPairs = new Set(allowlist.entries.map((e) => `${e.from}->${e.to}`));

  const files = findEntityFiles(root);
  const violations: { from: string; to: string; fromFile: string; toFile: string; line: number }[] = [];

  for (const file of files) {
    const fromMeta = entityMeta(file, tableToSchema);
    if (!fromMeta) continue;
    for (const imp of extractImports(file)) {
      if (!imp.path.startsWith('.')) continue; // skip lib imports
      const resolved = resolve(dirname(file), imp.path);
      const candidate = resolved.endsWith('.entity.ts') ? resolved : `${resolved}.entity.ts`;
      let toMeta: FileMeta | null;
      try { toMeta = entityMeta(candidate, tableToSchema); } catch { continue; }
      if (!toMeta || toMeta.domain === fromMeta.domain) continue;
      if (allowedPairs.has(`${fromMeta.logicalId}->${toMeta.logicalId}`)) continue;
      violations.push({ from: fromMeta.logicalId, to: toMeta.logicalId, fromFile: file, toFile: candidate, line: imp.line });
    }
  }

  if (ci) {
    console.log(JSON.stringify({ violations, total: violations.length }));
  } else if (violations.length > 0) {
    console.log(`\nCross-domain entity import violations (${violations.length}):\n`);
    for (const v of violations) {
      console.log(`  ${v.fromFile}:${v.line}`);
      console.log(`    ${v.from}  →  ${v.to}`);
    }
  } else {
    console.log('cross-domain-import-check: 0 violations');
  }
  process.exit(violations.length > 0 ? 1 : 0);
}

main();
```

- [ ] **Step 5: Run self-test**

```
npx tsx tools/scanners/cross-domain-import-check-selftest.ts
```

Expected: `cross-domain-import-check selftest: 2/2 assertions`.

- [ ] **Step 6: Add npm scripts + commit**

Edit `package.json`:
```json
"cross-domain:check": "npx tsx tools/scanners/cross-domain-import-check.ts",
"selftest:cross-domain": "npx tsx tools/scanners/cross-domain-import-check-selftest.ts"
```

```
git add tools/scanners/cross-domain-import-check.ts tools/scanners/cross-domain-import-check-selftest.ts tools/scanners/cross-domain-allowlist.json package.json
git commit -m "phase3-prelude: introduce cross-domain-import scanner"
```

### Task 4: Author `migration-filename-check.ts` scanner

**Files:**
- Create: `tools/scanners/migration-filename-check.ts`
- Create: `tools/scanners/migration-filename-check-selftest.ts`

- [ ] **Step 1: Write self-test (TDD)**

Create `tools/scanners/migration-filename-check-selftest.ts`:

```ts
import { execSync } from 'child_process';
import { writeFileSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

function runFixture(filenames: string[]): { code: number; stdout: string } {
  const dir = mkdtempSync(join(tmpdir(), 'migfn-'));
  for (const fn of filenames) writeFileSync(join(dir, fn), '');
  try {
    const stdout = execSync(`npx tsx tools/scanners/migration-filename-check.ts --root=${dir}`, { encoding: 'utf8' });
    return { code: 0, stdout };
  } catch (e: any) {
    return { code: e.status ?? 1, stdout: e.stdout?.toString() ?? '' };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// Fail: forbidden token
const r1 = runFixture(['1700000000000-temp-fix.ts']);
console.assert(r1.code !== 0, 'forbidden token "temp" should fail');

const r2 = runFixture(['1700000000000-add-users-retry.ts']);
console.assert(r2.code !== 0, 'forbidden token "retry" should fail');

// Fail: wrong format
const r3 = runFixture(['add-something.ts']);
console.assert(r3.code !== 0, 'non-timestamped name should fail');

// Pass: standard format, no forbidden token
const r4 = runFixture(['1700000000000-add-users-table.ts']);
console.assert(r4.code === 0, 'standard filename should pass');

console.log('migration-filename-check selftest: 4/4 assertions');
```

- [ ] **Step 2: Implement scanner**

Create `tools/scanners/migration-filename-check.ts`:

```ts
#!/usr/bin/env tsx
import { readdirSync } from 'fs';
import { join } from 'path';

const FORBIDDEN_TOKENS = ['temp', 'fix', 'final', 'final-final', 'retry', 'smoke', 'wip', 'draft'];
const VALID_RE = /^\d{14}-[a-z0-9]+(?:-[a-z0-9]+)*\.ts$/;

function parseArgs(argv: string[]): { root: string; ci: boolean } {
  let root = 'migrations';
  let ci = false;
  for (const arg of argv) {
    if (arg.startsWith('--root=')) root = arg.slice('--root='.length);
    else if (arg === '--ci') ci = true;
  }
  return { root, ci };
}

function collect(dir: string): string[] {
  let entries: string[] = [];
  try { entries = readdirSync(dir, { withFileTypes: true } as any).map((e: any) => e.isDirectory() ? collect(join(dir, e.name)) : [join(dir, e.name)]).flat(); } catch { return []; }
  return entries;
}

function main() {
  const { root, ci } = parseArgs(process.argv.slice(2));
  const files = collect(root).filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts'));
  const violations: { file: string; reason: string }[] = [];
  for (const file of files) {
    const basename = file.split(/[\\/]/).pop() ?? '';
    if (!VALID_RE.test(basename)) violations.push({ file, reason: `does not match pattern <14-digit-timestamp>-<kebab-case-name>.ts` });
    const lower = basename.toLowerCase();
    for (const tok of FORBIDDEN_TOKENS) {
      if (lower.includes(`-${tok}-`) || lower.endsWith(`-${tok}.ts`)) {
        violations.push({ file, reason: `contains forbidden token '${tok}'` });
      }
    }
  }
  if (ci) console.log(JSON.stringify({ violations, total: violations.length }));
  else if (violations.length > 0) {
    console.log(`\nMigration filename violations (${violations.length}):`);
    for (const v of violations) console.log(`  ${v.file} — ${v.reason}`);
  } else console.log('migration-filename-check: 0 violations');
  process.exit(violations.length > 0 ? 1 : 0);
}

main();
```

- [ ] **Step 3: Run self-test**

```
npx tsx tools/scanners/migration-filename-check-selftest.ts
```

Expected: `migration-filename-check selftest: 4/4 assertions`.

- [ ] **Step 4: Run against current `migrations/`**

```
npx tsx tools/scanners/migration-filename-check.ts
```

Expected: PASS (existing migrations already follow the pattern). If anything fails, fix the filename or escalate per the cross-wave rule before committing.

- [ ] **Step 5: Add script + commit**

Edit `package.json`:
```json
"migration-filename:check": "npx tsx tools/scanners/migration-filename-check.ts",
"selftest:migration-filename": "npx tsx tools/scanners/migration-filename-check-selftest.ts"
```

```
git add tools/scanners/migration-filename-check.ts tools/scanners/migration-filename-check-selftest.ts package.json
git commit -m "phase3-prelude: introduce migration-filename scanner"
```

### Task 5: Audit + commit the untracked `1940*-1942*` migration files

**Files:**
- Inspect: `migrations/instance/1940000000000-notify-schema.ts` through `1942000000000-cross-domain-read-diff-table.ts`

- [ ] **Step 1: List the untracked migrations**

```
git status --short migrations/instance/ | grep '^??'
```

Expected: 11 files listed.

- [ ] **Step 2: For each untracked migration, verify `up()` and `down()` exist or `// IRREVERSIBLE` is documented**

Open each file. Verify:
- Has a `public async up(qr: QueryRunner)` method.
- Has either `public async down(qr: QueryRunner)` OR a top-of-file doc comment beginning `/** IRREVERSIBLE:` with rationale.
- File class name matches the timestamp + a meaningful name.
- No forbidden tokens (`temp`, `fix`, `retry`, etc.) in the filename.

If any migration fails these checks, fix in place or move to deletion list (Step 4 below).

- [ ] **Step 3: For each retained migration, ensure schema-qualified identifiers**

Each migration's SQL must use fully-qualified table names (`identity.users`, not `users`). Scan each file for bare identifiers; either fix in place or document why a bare identifier is acceptable (e.g., a SET search_path inside a single migration transaction).

- [ ] **Step 4: Identify abandoned/draft files for deletion**

If any migration in the untracked set is a draft, partial, or experimental version, list it. Default: keep all 11. Only delete if the user confirms a file is abandoned.

- [ ] **Step 5: Run migration-filename scanner**

```
npx tsx tools/scanners/migration-filename-check.ts
```

Expected: PASS for all 11 files.

- [ ] **Step 6: Commit the migrations**

This commit is part of Stream 1's atomic landing — see Task 9. Stage them now but DO NOT commit yet:

```
git add migrations/instance/1940000000000-notify-schema.ts \
        migrations/instance/1940100000000-insights-schema.ts \
        migrations/instance/1940200000000-ava-schema.ts \
        migrations/instance/1940300000000-automation-schema.ts \
        migrations/instance/1940400000000-integrations-schema.ts \
        migrations/instance/1940500000000-identity-schema.ts \
        migrations/instance/1940600000000-app-builder-schema.ts \
        migrations/instance/1940700000000-metadata-schema.ts \
        migrations/instance/1941000000000-service-token-tables.ts \
        migrations/instance/1941100000000-seed-initial-service-accounts.ts \
        migrations/instance/1942000000000-cross-domain-read-diff-table.ts
```

### Task 6: Build/refine the schema manifest from migration source-of-truth

**Files:**
- Modify: `tools/scanners/entity-schema-manifest.json`

- [ ] **Step 1: Extract the `tables` array from each schema migration**

For each of the 8 schema migrations (notify, insights, ava, automation, integrations, identity, app_builder, metadata), open the file and copy the `private readonly tables = [...]` array verbatim into the manifest under that schema key.

- [ ] **Step 2: Verify against the live DB**

```
docker exec hw_postgres psql -U hubblewave -d hubblewave -c "SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema IN ('identity','metadata','automation','ava','notify','integrations','insights','app_builder') ORDER BY table_schema, table_name;"
```

Cross-reference: every table listed in the DB query must appear under the matching schema key in the manifest, and vice-versa. Discrepancies indicate either a missing migration commit or a manifest gap — fix the manifest.

- [ ] **Step 3: Verify `public` schema entry**

```
docker exec hw_postgres psql -U hubblewave -d hubblewave -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name NOT IN ('migrations') ORDER BY table_name;"
```

Add tables that should remain in `public` (e.g., `users`, `audit_logs`, `key_metadata`, `service_principals`) to the manifest's `public` array.

- [ ] **Step 4: Stage the manifest update**

```
git add tools/scanners/entity-schema-manifest.json
```

Do not commit yet — folds into Task 9's atomic commit.

### Task 7: Update entity decorators per domain schema

**Files:**
- Modify: ~130 `*.entity.ts` files across `libs/instance-db/src/lib/entities/**`, `apps/api/src/app/**`, `apps/control-plane/src/app/**`

**Execution batching:** Allowed and encouraged. Update entities one schema at a time (identity → metadata → automation → ava → notify → integrations → insights → app_builder). Run the scanner after each batch to confirm violation count is decreasing. **Final landing remains atomic** — the entity changes stage during these batches but the single `phase3-prelude: finalize schema split and remove runtime bridge` commit in Task 9 includes them all. Do not create intermediate commits during this task.

- [ ] **Step 1: Find all entity files**

```
find libs/instance-db apps/api apps/control-plane -name "*.entity.ts" -type f | wc -l
```

Expected: ~130. Record the actual count for verification later.

- [ ] **Step 2: Run scanner to capture baseline violation count**

```
npx tsx tools/scanners/entity-schema-ownership-check.ts --ci 2>&1 | tail -5
```

Record the violation count (let's call it `N0`).

- [ ] **Step 3: Update entities for each domain (one sub-step per schema)**

For each domain in the manifest (identity, metadata, automation, ava, notify, integrations, insights, app_builder), edit every entity whose table is in that schema:

Pattern (example for `users` in `identity`):
- Before: `@Entity('users')`
- After: `@Entity({ name: 'users', schema: 'identity' })`

Also update entities that declared a partial object form:
- Before: `@Entity({ name: 'roles' })`
- After: `@Entity({ name: 'roles', schema: 'identity' })`

Leave alone entities whose tables are in `public` schema (TypeORM default).

Suggested execution order — heaviest first (identity → metadata → automation → ava → notify → integrations → insights → app_builder), running the scanner after each domain pass to verify progress.

- [ ] **Step 4: After each domain, run scanner to confirm violation count decreasing**

```
npx tsx tools/scanners/entity-schema-ownership-check.ts --ci 2>&1 | tail -5
```

Expected: count decreases after each domain's entities are updated.

- [ ] **Step 5: Final pass — scanner reports 0 violations**

```
npx tsx tools/scanners/entity-schema-ownership-check.ts
```

Expected: `entity-schema-ownership-check: 0 violations`.

- [ ] **Step 6: Stage every modified entity file**

```
git add libs/instance-db/src/lib/entities apps/api/src/app apps/control-plane/src/app
```

Do not commit yet — folds into Task 9.

### Task 8: Run cross-domain import scanner; resolve violations

**Files:**
- Modify: any entity file that imports across domains
- Modify: `tools/scanners/cross-domain-allowlist.json` (only for entries with documented rationale)

- [ ] **Step 1: Run scanner**

```
npx tsx tools/scanners/cross-domain-import-check.ts
```

Expected: some violations — entities reference each other freely today.

- [ ] **Step 2: Triage each violation**

For each cross-domain import:
- **If the import is genuinely an FK relation between domains** (e.g., `RolePermission` in identity references `Permission` in identity — same domain, NOT a violation): scanner should pass. If it doesn't, the entity manifest is wrong; fix the manifest.
- **If the import is a `User` reference from any domain to public.users**: this is the most common legitimate case. Add allowlist entries with rationale `"FK to public.users"`.
- **If the import looks like genuine domain bleed**: prefer refactoring the entity to not need the cross-domain import. If refactor is out of scope for Prelude per the preservation boundary, add an allowlist entry with `rationale` + `followUp: 'W2'` so W2's boundary-consistency wave addresses it.

- [ ] **Step 3: Update `cross-domain-allowlist.json` with documented entries**

Each entry must have `from` + `to` (logical identifiers, NOT filesystem paths), `rationale`, `addedBy`, `addedAt`. Logical identifiers survive refactors better than paths. Example:

```json
{
  "$schema": "./allowlist-schema.json",
  "entries": [
    {
      "from": "identity.user-role",
      "to": "public.user",
      "rationale": "FK to public.users; users intentionally stays in public per schema-split design.",
      "addedBy": "<your-handle>",
      "addedAt": "2026-05-14"
    }
  ]
}
```

- [ ] **Step 4: Re-run scanner — verify 0 violations**

```
npx tsx tools/scanners/cross-domain-import-check.ts
```

Expected: 0 violations.

- [ ] **Step 5: Stage allowlist + any entity refactors**

```
git add tools/scanners/cross-domain-allowlist.json
```

(Plus any entity files you refactored.) Do not commit yet.

### Task 9: Atomic Stream 1 landing — entities + migrations + search_path removal

**Files:**
- Modify: `libs/instance-db/src/lib/instance-db.module.ts` (remove `search_path` line)

- [ ] **Step 1: Remove the `search_path` bridge from runtime DataSource**

Edit `libs/instance-db/src/lib/instance-db.module.ts`. Find the `options` field in the `extra` block:

```ts
options:
  '-c statement_timeout=30000 ' +
  '-c search_path=public,identity,metadata,automation,ava,notify,integrations,insights,app_builder',
```

Replace with:

```ts
options: '-c statement_timeout=30000',
```

Also remove the multi-line comment block above it (the one explaining the bridge), since the bridge no longer exists. The block starts with `// search_path includes every domain schema...` and continues until `// could otherwise hit a same-named table in a domain schema.`.

- [ ] **Step 2: Run scanners — all three must pass**

```
npx tsx tools/scanners/entity-schema-ownership-check.ts && \
npx tsx tools/scanners/cross-domain-import-check.ts && \
npx tsx tools/scanners/migration-filename-check.ts
```

Expected: all three exit 0.

- [ ] **Step 3: Fresh-DB rebuild + smoke (with readiness polling, not fixed sleeps)**

Use readiness polling — fixed `sleep`s create CI flakiness. Postgres has `pg_isready`; apps/api exposes `/api/health`.

```bash
docker-compose down -v && docker-compose up -d

# Poll Postgres until ready (max 60s)
for i in $(seq 1 30); do
  if docker exec hw_postgres pg_isready -U hubblewave -d hubblewave >/dev/null 2>&1; then echo "postgres ready (iter=$i)"; break; fi
  sleep 2
done

npm run migration:run:control-plane && \
npm run migration:run:instance && \
npx tsx scripts/seed-admin-user.ts
```

Expected: every command exits 0. No "relation does not exist" errors. Admin user seeded.

- [ ] **Step 4: Start apps/api with health polling and curl login**

```bash
npm run dev:api &
DEV_PID=$!

# Poll /api/health until ready (max 120s)
for i in $(seq 1 60); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health 2>/dev/null)
  if [ "$CODE" = "200" ]; then echo "api ready (iter=$i)"; break; fi
  sleep 2
done

PW=$(grep '^ADMIN_PASSWORD=' .env | cut -d= -f2-)
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"admin@hubblewave.local\",\"password\":\"$PW\",\"instanceSlug\":\"default\"}" | head -c 200

kill $DEV_PID 2>/dev/null || true
```

Expected: response contains `"accessToken":"eyJ...` (valid ES256 JWT).

- [ ] **Step 5: Generate the schema ownership map artifact**

Create `tools/scanners/generate-schema-ownership-map.ts`:

```ts
#!/usr/bin/env tsx
/**
 * Generates docs/architecture/schema-ownership-map.md from the entity manifest
 * and cross-domain allowlist. The output is a human-readable artifact:
 *   - schema → owning domain
 *   - tables per schema
 *   - public exceptions (tables intentionally NOT in a domain schema)
 *   - allowlisted cross-domain relations
 *
 * Regenerated whenever the manifest or allowlist changes. Committed alongside.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

const manifest = JSON.parse(readFileSync('tools/scanners/entity-schema-manifest.json', 'utf8'));
const allowlist = JSON.parse(readFileSync('tools/scanners/cross-domain-allowlist.json', 'utf8'));

const out = ['# Schema Ownership Map',
  '',
  `_Generated_ from \`tools/scanners/entity-schema-manifest.json\` + \`tools/scanners/cross-domain-allowlist.json\`. **Do not edit by hand.** Regenerate with \`npx tsx tools/scanners/generate-schema-ownership-map.ts\`.`,
  '',
  '## Domain schemas',
  ''];

for (const [schema, tables] of Object.entries(manifest)) {
  if (schema === 'public') continue;
  out.push(`### \`${schema}\``);
  out.push('');
  for (const t of (tables as string[]).sort()) out.push(`- \`${schema}.${t}\``);
  out.push('');
}

out.push('## Public-schema exceptions');
out.push('');
out.push('Tables intentionally kept in `public` (cross-domain shared or instance-wide singleton):');
out.push('');
for (const t of (manifest.public ?? []).sort()) out.push(`- \`public.${t}\``);
out.push('');

out.push('## Allowlisted cross-domain relations');
out.push('');
if (!allowlist.entries.length) {
  out.push('_(none)_');
} else {
  out.push('| From | To | Rationale | Added by | Added at |');
  out.push('|---|---|---|---|---|');
  for (const e of allowlist.entries) {
    out.push(`| \`${e.from}\` | \`${e.to}\` | ${e.rationale} | ${e.addedBy} | ${e.addedAt} |`);
  }
}
out.push('');

mkdirSync('docs/architecture', { recursive: true });
writeFileSync('docs/architecture/schema-ownership-map.md', out.join('\n'));
console.log('Wrote docs/architecture/schema-ownership-map.md');
```

Run it:

```bash
npx tsx tools/scanners/generate-schema-ownership-map.ts
```

Expected: prints `Wrote docs/architecture/schema-ownership-map.md`. Open the file and confirm it looks sensible (every domain listed, public exceptions shown, allowlist table populated).

Add npm script:
```json
"schema-map:generate": "npx tsx tools/scanners/generate-schema-ownership-map.ts"
```

- [ ] **Step 6: Atomic commit**

```
git add libs/instance-db/src/lib/instance-db.module.ts \
        tools/scanners/generate-schema-ownership-map.ts \
        docs/architecture/schema-ownership-map.md \
        package.json
# (Tasks 5, 6, 7, 8 already staged migrations + manifest + entities + allowlist)
git commit -m "phase3-prelude: finalize schema split and remove runtime bridge"
```

Verify with:
```
git show --stat HEAD | head -25
```

Expected output should include: 11 new migration files, 1 manifest file, 1 allowlist file, 1 instance-db.module.ts modification, 1 schema-ownership-map generator, 1 schema-ownership-map.md, ~130 entity file modifications.

### Task 10: Stream 1 exit gate — re-verify everything is green

**Files:** none (verification only)

- [ ] **Step 1: All scanners pass**

```
npx tsx tools/scanners/entity-schema-ownership-check.ts && \
npx tsx tools/scanners/cross-domain-import-check.ts && \
npx tsx tools/scanners/migration-filename-check.ts
```

Expected: all three exit 0.

- [ ] **Step 2: All scanner self-tests pass**

```
npx tsx tools/scanners/entity-schema-ownership-check-selftest.ts && \
npx tsx tools/scanners/cross-domain-import-check-selftest.ts && \
npx tsx tools/scanners/migration-filename-check-selftest.ts
```

Expected: all assertions pass.

- [ ] **Step 3: Empty DB → boot → login still works**

Repeat Task 9 Step 3 + Step 4 from a fresh DB. Expected: identical results.

- [ ] **Step 4: No `search_path` reference anywhere in runtime code**

```
git grep "search_path" -- "*.ts" ":!docs/" ":!migrations/"
```

Expected: zero matches outside docs and migrations.

Stream 1 done. Proceed to Stream 2.

---

## Stream 2 — Compatibility Shim Removal

**Stream goal:** Remove every remaining Phase 1/2 compatibility shim. Delete the duplicate `PermissionsGuard`. Canonicalize on the lib version with the transitional warn-and-allow posture. Stand up the annotation-coverage scanners. Commit the remaining real smoke fixes.

**Stream exit gate:** Login works via both `/api/auth/login` and `/api/identity/auth/login`. Both coverage scanners run (with non-zero baselines that are tracked, not zeroed). Duplicate guard file no longer exists.

**Decomposition:**
- Task 11 is **Destructive Cleanup** (delete duplicate guard).
- Task 12 is **Mechanical** (point identity module at lib guard).
- Tasks 13–14 are **CI / Scanner** (coverage scanners).
- Task 15 is **Mechanical** (Vite proxy comment).
- Tasks 16–17 are **Destructive Cleanup** (dead-code + KNOWN_DEFERRED_OFFENDERS sweep + obsolete script).
- Task 18 is **Mechanical** (commit the remaining real smoke fixes).
- Task 19 is **Architectural Validation** (Stream 2 exit gate).

### Task 11: Delete the duplicate `PermissionsGuard` in apps/api

**Files:**
- Delete: `apps/api/src/app/identity/auth/guards/permissions.guard.ts`

- [ ] **Step 1: Verify no other code references the local guard**

```
git grep "auth/guards/permissions.guard" apps/api/src
```

If anything other than `apps/api/src/app/identity/identity.module.ts` shows up, those callers need to be redirected to the lib import first. Expected primary result: `identity.module.ts` imports it.

- [ ] **Step 2: Delete the file**

```
rm "apps/api/src/app/identity/auth/guards/permissions.guard.ts"
```

- [ ] **Step 3: Confirm the delete**

```
ls "apps/api/src/app/identity/auth/guards/" | grep permissions || echo "deleted"
```

Expected: `deleted`.

### Task 12: Point `identity.module.ts` at the canonical lib `PermissionsGuard`

**Files:**
- Modify: `apps/api/src/app/identity/identity.module.ts`

- [ ] **Step 1: Update the import**

Edit `apps/api/src/app/identity/identity.module.ts`. Find:

```ts
import { PermissionsGuard } from './auth/guards/permissions.guard';
```

Replace with:

```ts
import { PermissionsGuard } from '@hubblewave/auth-guard';
```

- [ ] **Step 2: Verify the module still type-checks**

```
npx nx build api --skip-nx-cache 2>&1 | tail -20
```

Expected: build succeeds.

- [ ] **Step 3: Restart dev:platform and verify login**

If `dev:platform` is running, save the file and NX hot-reloads. Otherwise:

```
npm run dev:api &
sleep 30
PW=$(grep '^ADMIN_PASSWORD=' .env | cut -d= -f2-)
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"admin@hubblewave.local\",\"password\":\"$PW\",\"instanceSlug\":\"default\"}"
```

Expected: HTTP 201.

- [ ] **Step 4: Commit**

```
git add apps/api/src/app/identity/auth/guards/permissions.guard.ts apps/api/src/app/identity/identity.module.ts
git commit -m "phase3-prelude: delete duplicate PermissionsGuard implementation"
```

### Task 13: Author `permissions-annotation-coverage.ts` scanner

**Files:**
- Create: `tools/scanners/permissions-annotation-coverage.ts`
- Create: `tools/scanners/permissions-annotation-coverage-selftest.ts`
- Create: `docs/permissions-rollout-coverage.md`

**Caveat (documented limitation):** This scanner uses a heuristic — it looks **up to 12 lines above** each HTTP-method decorator (`@Get`, `@Post`, etc.) for a permission annotation (`@RequirePermission`, `@Roles`, `@Public`, `@AuthenticatedOnly`). Multi-line decorators with comments interleaved, long class-level annotation chains, or decorators authored in unusual whitespace patterns may silently undercount. This is the scanner most likely to give false negatives.

**Mitigation paths if undercounting becomes operationally significant:**
- Increase the scan window (cheap).
- Replace the regex walk with `ts-morph` / `@typescript-eslint/parser` AST analysis (medium effort, robust).
- Add an opt-in `// permissions-coverage-ignore-next` marker for known-good cases (lightweight).

The scanner is **reporting-only** (no fail-CI on uncovered handlers) so a heuristic miss does not break the build — it just under-reports the rollout coverage percentage. The rollout coverage report is read by humans deciding when to flip to deny-by-default, so under-reporting is biased toward "do not flip yet" — the safe direction.

- [ ] **Step 1: Write self-test (TDD)**

Create `tools/scanners/permissions-annotation-coverage-selftest.ts`:

```ts
import { execSync } from 'child_process';
import { writeFileSync, mkdtempSync, rmSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

function runFixture(controllerContent: string): { code: number; stdout: string } {
  const dir = mkdtempSync(join(tmpdir(), 'permcov-'));
  mkdirSync(join(dir, 'src'));
  writeFileSync(join(dir, 'src/users.controller.ts'), controllerContent);
  try {
    const stdout = execSync(`npx tsx tools/scanners/permissions-annotation-coverage.ts --root=${dir} --ci`, { encoding: 'utf8' });
    return { code: 0, stdout };
  } catch (e: any) {
    return { code: e.status ?? 1, stdout: e.stdout?.toString() ?? '' };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const annotated = `@Controller('users')
export class UsersController {
  @RequirePermission('users.view')
  @Get()
  list() {}
}`;
const r1 = runFixture(annotated);
console.assert(r1.code === 0, 'annotated handler reports 1/1');
console.assert(r1.stdout.includes('"annotated":1'), 'annotated count = 1');

const unannotated = `@Controller('users')
export class UsersController {
  @Get()
  list() {}
}`;
const r2 = runFixture(unannotated);
console.assert(r2.code === 0, 'coverage scanner does not fail on unannotated; just reports');
console.assert(r2.stdout.includes('"unannotated":1'), 'unannotated count = 1');

console.log('permissions-annotation-coverage selftest: 3/3 assertions');
```

- [ ] **Step 2: Implement scanner — REPORTING ONLY, does not fail CI**

Create `tools/scanners/permissions-annotation-coverage.ts`. The scanner WALKS controllers, INVENTORIES handlers, EMITS a coverage report. It does NOT fail CI (per the spec's transitional posture).

```ts
#!/usr/bin/env tsx
import { readFileSync, readdirSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';

const ANNOTATIONS = ['@RequirePermission', '@Permissions', '@Roles', '@Public', '@AuthenticatedOnly'];
const HTTP_DECORATORS = ['@Get', '@Post', '@Put', '@Patch', '@Delete'];

function parseArgs(argv: string[]): { root: string; ci: boolean; report?: string } {
  let root = 'apps/api/src';
  let ci = false;
  let report: string | undefined;
  for (const arg of argv) {
    if (arg.startsWith('--root=')) root = arg.slice('--root='.length);
    else if (arg.startsWith('--report=')) report = arg.slice('--report='.length);
    else if (arg === '--ci') ci = true;
  }
  return { root, ci, report };
}

function findControllers(root: string): string[] {
  const out: string[] = [];
  function walk(d: string) {
    let entries: string[] = [];
    try { entries = readdirSync(d); } catch { return; }
    for (const e of entries) {
      const full = join(d, e);
      let s; try { s = statSync(full); } catch { continue; }
      if (s.isDirectory()) {
        if (e === 'node_modules' || e === 'dist' || e === '.git') continue;
        walk(full);
      } else if (e.endsWith('.controller.ts')) out.push(full);
    }
  }
  walk(root);
  return out;
}

interface Handler { file: string; line: number; method: string; className: string; annotated: boolean }

function extractHandlers(file: string): Handler[] {
  const src = readFileSync(file, 'utf8');
  const lines = src.split('\n');
  const results: Handler[] = [];
  let className = '';
  const classRe = /^export\s+class\s+(\w+)/;
  // Scan window: 12 lines above the HTTP decorator. See Task 13 caveat for
  // why this is heuristic and what the failure modes look like.
  const SCAN_WINDOW = 12;
  for (let i = 0; i < lines.length; i++) {
    const cm = classRe.exec(lines[i]);
    if (cm) className = cm[1];
    for (const dec of HTTP_DECORATORS) {
      if (lines[i].trim().startsWith(dec)) {
        let annotated = false;
        for (let j = Math.max(0, i - SCAN_WINDOW); j < i; j++) {
          if (ANNOTATIONS.some((a) => lines[j].includes(a))) { annotated = true; break; }
        }
        const methodLine = lines.slice(i + 1).find((l) => /^\s*(async\s+)?\w+\s*\(/.test(l));
        const methodMatch = methodLine ? /^\s*(?:async\s+)?(\w+)\s*\(/.exec(methodLine) : null;
        const method = methodMatch ? methodMatch[1] : '<unknown>';
        results.push({ file, line: i + 1, method, className, annotated });
      }
    }
  }
  return results;
}

function main() {
  const { root, ci, report } = parseArgs(process.argv.slice(2));
  const files = findControllers(root);
  const all: Handler[] = [];
  for (const f of files) all.push(...extractHandlers(f));
  const annotated = all.filter((h) => h.annotated);
  const unannotated = all.filter((h) => !h.annotated);
  const summary = {
    total: all.length,
    annotated: annotated.length,
    unannotated: unannotated.length,
    coverage_pct: all.length === 0 ? 100 : Math.round((annotated.length / all.length) * 1000) / 10,
    unannotated_handlers: unannotated.map((h) => `${h.file}:${h.line} (${h.className}.${h.method})`),
  };
  if (ci) {
    console.log(JSON.stringify(summary));
  } else {
    console.log(`PermissionsGuard annotation coverage: ${summary.annotated}/${summary.total} (${summary.coverage_pct}%)`);
    if (summary.unannotated > 0) {
      console.log('\nUnannotated handlers:');
      for (const u of summary.unannotated_handlers.slice(0, 30)) console.log(`  ${u}`);
      if (summary.unannotated_handlers.length > 30) console.log(`  ...and ${summary.unannotated_handlers.length - 30} more`);
    }
  }
  if (report) writeFileSync(report, `# PermissionsGuard Annotation Rollout Coverage\n\n_Last updated_: ${new Date().toISOString()}\n\n- **Total handlers:** ${summary.total}\n- **Annotated:** ${summary.annotated}\n- **Unannotated:** ${summary.unannotated}\n- **Coverage:** ${summary.coverage_pct}%\n\nThe deny-by-default flip is gated by 100% coverage. See spec at \`docs/superpowers/specs/2026-05-14-phase3-roadmap-and-prelude-design.md\` (Stream 2 — Compatibility Shim Removal).\n`);
  // Reporting only: never fail CI. Rollout coverage is tracked, not enforced as 100% gate.
  process.exit(0);
}

main();
```

- [ ] **Step 3: Run self-test**

```
npx tsx tools/scanners/permissions-annotation-coverage-selftest.ts
```

Expected: `permissions-annotation-coverage selftest: 3/3 assertions`.

- [ ] **Step 4: Generate the baseline coverage report**

```
npx tsx tools/scanners/permissions-annotation-coverage.ts --report=docs/permissions-rollout-coverage.md
```

Inspect `docs/permissions-rollout-coverage.md`. It now lists current coverage.

- [ ] **Step 5: Commit**

Edit `package.json`:
```json
"permissions-coverage:check": "npx tsx tools/scanners/permissions-annotation-coverage.ts --report=docs/permissions-rollout-coverage.md",
"selftest:permissions-coverage": "npx tsx tools/scanners/permissions-annotation-coverage-selftest.ts"
```

```
git add tools/scanners/permissions-annotation-coverage.ts tools/scanners/permissions-annotation-coverage-selftest.ts docs/permissions-rollout-coverage.md package.json
git commit -m "phase3-prelude: introduce permissions-annotation-coverage scanner"
```

### Task 14: Author `abac-coverage-check.ts` scanner

**Files:**
- Create: `tools/scanners/abac-coverage-check.ts`
- Create: `tools/scanners/abac-coverage-check-selftest.ts`

- [ ] **Step 1: Write self-test (TDD)**

Create `tools/scanners/abac-coverage-check-selftest.ts`:

```ts
import { execSync } from 'child_process';
import { writeFileSync, mkdtempSync, rmSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

function run(content: string): { code: number; stdout: string } {
  const dir = mkdtempSync(join(tmpdir(), 'abaccov-'));
  mkdirSync(join(dir, 'src'));
  writeFileSync(join(dir, 'src/test.controller.ts'), content);
  try {
    const stdout = execSync(`npx tsx tools/scanners/abac-coverage-check.ts --root=${dir}`, { encoding: 'utf8' });
    return { code: 0, stdout };
  } catch (e: any) {
    return { code: e.status ?? 1, stdout: e.stdout?.toString() ?? '' };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

// Fail: class uses AbacGuard but method has no abac/skip/public/authenticated
const r1 = run(`@Controller('x')
@UseGuards(AbacGuard)
export class XController {
  @Get()
  list() {}
}`);
console.assert(r1.code !== 0, 'unannotated handler under AbacGuard should fail');

// Pass: class uses AbacGuard, method has @AbacResource
const r2 = run(`@Controller('x')
@UseGuards(AbacGuard)
export class XController {
  @AbacResource('records', 'list')
  @Get()
  list() {}
}`);
console.assert(r2.code === 0, 'annotated handler under AbacGuard should pass');

// Pass: class does NOT use AbacGuard — out of scope for this scanner
const r3 = run(`@Controller('x')
export class XController {
  @Get()
  list() {}
}`);
console.assert(r3.code === 0, 'controller without AbacGuard is out of scope');

console.log('abac-coverage-check selftest: 3/3 assertions');
```

- [ ] **Step 2: Implement scanner — FAILS CI on violations (unlike permissions-coverage)**

The AbacGuard is opt-in. When a controller IS opted in, every handler MUST have a valid ABAC annotation. This scanner enforces that contract — failing CI on violations.

Create `tools/scanners/abac-coverage-check.ts`:

```ts
#!/usr/bin/env tsx
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const ABAC_ANNOTATIONS = ['@AbacResource', '@SkipAbac', '@Public', '@AuthenticatedOnly'];
const HTTP_DECORATORS = ['@Get', '@Post', '@Put', '@Patch', '@Delete'];

function parseArgs(argv: string[]): { root: string; ci: boolean } {
  let root = 'apps/api/src';
  let ci = false;
  for (const a of argv) {
    if (a.startsWith('--root=')) root = a.slice('--root='.length);
    else if (a === '--ci') ci = true;
  }
  return { root, ci };
}

function findControllers(root: string): string[] {
  const out: string[] = [];
  function walk(d: string) {
    let entries: string[] = [];
    try { entries = readdirSync(d); } catch { return; }
    for (const e of entries) {
      const full = join(d, e);
      let s; try { s = statSync(full); } catch { continue; }
      if (s.isDirectory()) {
        if (e === 'node_modules' || e === 'dist' || e === '.git') continue;
        walk(full);
      } else if (e.endsWith('.controller.ts')) out.push(full);
    }
  }
  walk(root);
  return out;
}

function classUsesAbac(src: string): boolean {
  return /@UseGuards\([^)]*\bAbacGuard\b/.test(src);
}

function findHandlers(src: string): { method: string; line: number; annotated: boolean }[] {
  const lines = src.split('\n');
  const out: { method: string; line: number; annotated: boolean }[] = [];
  for (let i = 0; i < lines.length; i++) {
    for (const dec of HTTP_DECORATORS) {
      if (lines[i].trim().startsWith(dec)) {
        let annotated = false;
        for (let j = Math.max(0, i - 8); j < i; j++) {
          if (ABAC_ANNOTATIONS.some((a) => lines[j].includes(a))) { annotated = true; break; }
        }
        const methodLine = lines.slice(i + 1).find((l) => /^\s*(?:async\s+)?\w+\s*\(/.test(l));
        const m = methodLine ? /^\s*(?:async\s+)?(\w+)\s*\(/.exec(methodLine) : null;
        out.push({ method: m ? m[1] : '<unknown>', line: i + 1, annotated });
      }
    }
  }
  return out;
}

function main() {
  const { root, ci } = parseArgs(process.argv.slice(2));
  const violations: { file: string; method: string; line: number }[] = [];
  for (const file of findControllers(root)) {
    const src = readFileSync(file, 'utf8');
    if (!classUsesAbac(src)) continue;
    for (const h of findHandlers(src)) {
      if (!h.annotated) violations.push({ file, method: h.method, line: h.line });
    }
  }
  if (ci) console.log(JSON.stringify({ violations, total: violations.length }));
  else if (violations.length > 0) {
    console.log(`AbacGuard coverage violations (${violations.length}):`);
    for (const v of violations) console.log(`  ${v.file}:${v.line} — ${v.method}() lacks @AbacResource/@SkipAbac/@Public/@AuthenticatedOnly`);
  } else console.log('abac-coverage-check: 0 violations');
  process.exit(violations.length > 0 ? 1 : 0);
}

main();
```

- [ ] **Step 3: Run self-test**

```
npx tsx tools/scanners/abac-coverage-check-selftest.ts
```

Expected: `abac-coverage-check selftest: 3/3 assertions`.

- [ ] **Step 4: Run against current codebase**

```
npx tsx tools/scanners/abac-coverage-check.ts
```

Expected: 0 violations (because we removed AbacGuard from global wiring in Phase 1/2; no controllers should currently use it opt-in. If any do, they need annotations).

- [ ] **Step 5: Commit**

Edit `package.json`:
```json
"abac-coverage:check": "npx tsx tools/scanners/abac-coverage-check.ts",
"selftest:abac-coverage": "npx tsx tools/scanners/abac-coverage-check-selftest.ts"
```

```
git add tools/scanners/abac-coverage-check.ts tools/scanners/abac-coverage-check-selftest.ts package.json
git commit -m "phase3-prelude: introduce abac-coverage scanner"
```

### Task 15: Annotate Vite proxy as transitional

**Files:**
- Modify: `apps/web-client/vite.config.mts`

- [ ] **Step 1: Add transitional comment at the top of the proxy block**

Find the comment block above `proxy: {` and prepend (or replace the existing comment with):

```ts
    // TRANSITIONAL (Phase 3 Prelude → finalized in a later wave):
    // The strip-prefix rewrites below bridge the web client's per-service
    // URL convention (VITE_*_API_URL = '/api/identity', etc.) to apps/api's
    // unified URL space. This proxy stays as dev convenience until the web
    // client's VITE_*_API_URL defaults are aligned with apps/api's routes
    // directly (a later wave decides timing).
    //
```

- [ ] **Step 2: Save (no commit yet — folds into Task 18)**

### Task 16: Sweep `tools/dead-code-allowlist.json` and `KNOWN_DEFERRED_OFFENDERS`

**Files:**
- Modify: `tools/dead-code-allowlist.json`
- Modify: any `tools/*.ts` files with `KNOWN_DEFERRED_OFFENDERS` arrays

- [ ] **Step 1: List current dead-code allowlist entries**

```
cat tools/dead-code-allowlist.json
```

- [ ] **Step 2: For each entry, verify if it's still live code or now deletable**

For each allowlist entry: check if the referenced file/symbol still exists and is still used. If unused, mark for deletion. If still relevant, leave it but ensure `rationale` + `addedBy` + `addedAt` are populated (per the scanner conventions Task 1 established).

- [ ] **Step 3: Sweep `KNOWN_DEFERRED_OFFENDERS` lists**

```
git grep -l "KNOWN_DEFERRED_OFFENDERS" -- "tools/*.ts"
```

For each file: open it, inspect each entry, check if the deferred issue still exists in the codebase. If resolved, delete the entry. If not, ensure it has `followUp` pointing to the wave that will close it.

- [ ] **Step 4: Verify scanners still pass after sweep**

```
npm run audit:check && npm run dead-code:check && npm run authz:check
```

Expected: all pass (or fail with documented allowlist entries only).

- [ ] **Step 5: Stage changes** (commit folds into Task 18)

### Task 17: Delete obsolete dev secret script if predates canon §29.9

**Files:**
- Delete: `scripts/generate-local-dev-secrets.ts` (only if confirmed obsolete)

- [ ] **Step 1: Inspect the script**

```
cat scripts/generate-local-dev-secrets.ts | head -30
```

- [ ] **Step 2: Decision**

If the script generates legacy HS256 `JWT_SECRET` values (pre-canon §29.9 ES256 path) and is not referenced by any current bootstrap path, delete it.

If it still generates something useful (e.g., random `JWT_BOOTSTRAP_SECRET`, `DB_PASSWORD`, etc.) and is referenced by `scripts/setup.ts`, KEEP it but verify it doesn't emit anything stale.

- [ ] **Step 3: If deleting**

```
rm scripts/generate-local-dev-secrets.ts
```

- [ ] **Step 4: Stage (commit folds into Task 18)**

### Task 18: Commit remaining Stream 2 fixes in a single composite commit

**Files:** (staged from Tasks 15–17)
- `apps/web-client/vite.config.mts` (transitional comment)
- `tools/dead-code-allowlist.json` (swept)
- Various `tools/*.ts` (KNOWN_DEFERRED_OFFENDERS swept)
- Possibly `scripts/generate-local-dev-secrets.ts` (deleted)

- [ ] **Step 1: Verify staged set**

```
git status --short
```

Expected: the files modified or deleted across Tasks 15–17.

- [ ] **Step 2: Commit**

```
git commit -m "phase3-prelude: remove residual compatibility shims and obsolete dev script"
```

(Adjust the message to match what actually landed if the dev script was kept.)

### Task 19: Stream 2 exit gate

**Files:** none (verification only)

- [ ] **Step 1: Login still works through both routes**

**Why both routes are validated:** Prelude preserves both `/api/auth/login` (canonical) and `/api/identity/auth/login` (alias via `IdentityAuthAliasController`) **temporarily** because frontend axios callers still post to the `/api/identity/auth/*` URL space. The Vite proxy strip rewrites `/api/identity` → `/api`, but the alias controller is also a valid path. If Stream 3 deletes the alias controller, the Vite proxy strip becomes load-bearing — and that's a downstream W3 decision (align `VITE_*_API_URL` defaults), not a Prelude one. Until then, both routes must respond.

```bash
npm run dev:api &
DEV_PID=$!
for i in $(seq 1 60); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health 2>/dev/null)
  if [ "$CODE" = "200" ]; then break; fi
  sleep 2
done
PW=$(grep '^ADMIN_PASSWORD=' .env | cut -d= -f2-)
BODY="{\"username\":\"admin@hubblewave.local\",\"password\":\"$PW\",\"instanceSlug\":\"default\"}"
for URL in "http://localhost:3000/api/auth/login" "http://localhost:3000/api/identity/auth/login"; do
  CODE=$(curl -s -o /tmp/r -w "%{http_code}" -X POST "$URL" -H "Content-Type: application/json" -d "$BODY")
  echo "$URL → $CODE"
done
kill $DEV_PID 2>/dev/null || true
```

Expected: both return 201.

- [ ] **Step 2: Coverage scanners run + produce reports**

```
npm run permissions-coverage:check
npm run abac-coverage:check
```

Expected: permissions coverage prints summary (any baseline coverage acceptable; report is tracked); abac coverage exits 0.

- [ ] **Step 3: Duplicate guard file does not exist**

```
ls apps/api/src/app/identity/auth/guards/permissions.guard.ts 2>&1
```

Expected: "No such file or directory" or `ls` error.

Stream 2 done. Proceed to Stream 3.

---

## Stream 3 — Obsolete Product Surface Removal

**Stream goal:** Inventory every surface that no longer represents the current product (backend modules, DTOs, frontend routes, navigation entries, feature flags, dead env vars, dead docker services, `.bak`/`.old`/`.tmp`/`.disabled` files, abandoned hooks/stores). Surface findings to the user for approval as a single deletion-ledger PR. Execute the approved deletions in one atomic commit.

**Deletion safety rule (binding):** No deletion commit may introduce TypeScript compile errors, unresolved imports, broken route references, or failing scanners. Every approved deletion must be cleanable in one atomic commit AND every cross-reference to the deleted surface must be deleted in the same commit. Verification (TypeScript build + scanner run + dual-route smoke) is part of Task 27.

**Stream exit gate:** Single approved-by-user deletion commit landed. TypeScript build clean. All scanners pass. Dual login routes still respond (Task 19's invariant preserved unless the user explicitly approves the alias deletion).

**Decomposition:**
- Tasks 20–24 are **Architectural Validation** (candidate discovery, one task per surface category).
- Task 25 is **Architectural Validation** (assemble ledger PR).
- **Task 26 is a USER APPROVAL GATE** — execution stops here until user approves the ledger.
- Task 27 is **Destructive Cleanup** (execute approved deletions).

### Task 20: Discover obsolete backend modules / controllers / DTOs

**Files:** scan-only

- [ ] **Step 1: List the `apps/svc-*` directories on disk**

```
ls apps/ | grep '^svc-' || echo "(none)"
```

Expected: 11 directories (`svc-automation`, `svc-ava`, etc.) — Phase 1 leftovers.

- [ ] **Step 2: List the `IdentityAuthAliasController` if it still exists**

```
ls apps/api/src/app/instance-api/identity/auth/identity-auth-alias.controller.ts 2>&1
```

If present: candidate for deletion (the Vite proxy strip rewrites `/api/identity/auth/login` to `/api/auth/login` so the alias is now redundant).

- [ ] **Step 3: Scan for `phase7/*` controllers**

```
git ls-files apps/api/src | grep -E "phase7"
```

For each result: if not part of the canonical Phase 3 W5 LLM-assisted features, mark as candidate.

- [ ] **Step 4: Scan for orphaned DTOs**

```
# Find every DTO file
git ls-files | grep -E '\.dto\.ts$' > /tmp/all-dtos.txt
# For each, check if anything imports it
while read dto; do
  base=$(basename "$dto" .ts)
  count=$(git grep -l "from .*\\b${base}\\b" -- '*.ts' | grep -v "$dto" | wc -l)
  if [ "$count" = "0" ]; then echo "ORPHAN: $dto"; fi
done < /tmp/all-dtos.txt
```

Record orphans.

- [ ] **Step 5: Scan for stale generated clients in libs/api-clients/**

If `libs/api-clients/` exists, check whether each file targets a still-live endpoint. Untracked status suggests generated drift — check if used.

- [ ] **Step 6: Record findings**

Write findings to a working notes file (not committed): `/tmp/prelude-stream3-backend-candidates.md`.

### Task 21: Discover obsolete frontend surfaces

**Files:** scan-only

- [ ] **Step 1: List web-client routes**

```
git grep -E "<Route\\s+path=" apps/web-client/src
```

For each route: check whether the component it points to still exists.

- [ ] **Step 2: Scan for unused SDK exports**

```
# For each export in libs/* index.ts files
git ls-files libs/ | grep "src/index.ts$" | while read idx; do
  grep -oE "export.*from\\s+['\"]\\..*['\"]" "$idx" | while read line; do
    # Could be expanded; record candidates
    echo "$idx | $line"
  done
done > /tmp/lib-exports.txt
```

Cross-check: each export's symbol must be imported by something. Tooling: use `ts-prune` if available, or manual grep.

- [ ] **Step 3: Scan for abandoned hooks/providers/stores**

```
git ls-files apps/web-client/src | grep -E "use[A-Z]|Provider\\.tsx?$|store\\.ts$" | while read f; do
  symbol=$(basename "$f" .ts | sed 's/\.tsx//')
  importers=$(git grep -l "from .*\\b${symbol}\\b" apps/web-client/src | grep -v "^${f}$" | wc -l)
  if [ "$importers" = "0" ]; then echo "ORPHAN: $f"; fi
done
```

Record orphans.

- [ ] **Step 4: Record findings**

`/tmp/prelude-stream3-frontend-candidates.md`.

### Task 22: Discover obsolete navigation / actions / feature flags

**Files:** scan-only

- [ ] **Step 1: Inspect navigation seed**

```
git grep -nE "INSERT INTO .*navigation" migrations/instance/ scripts/
```

For each navigation row: confirm the target route exists in the web client. List orphaned nav entries.

- [ ] **Step 2: Inspect feature flags**

```
git grep -nE "feature\\.[a-z_]+" -- '*.ts' '*.tsx'
```

For each flag: check if its referencing branch represents a current-product feature or an abandoned experiment.

- [ ] **Step 3: Inspect web-client menu definitions**

```
git ls-files apps/web-client/src | grep -iE "(menu|sidebar|nav).*(\\.ts|\\.tsx)$" | head -10
```

For each menu definition: check that every entry targets a live route + still-relevant module.

- [ ] **Step 4: Record findings**

`/tmp/prelude-stream3-nav-flags-candidates.md`.

### Task 23: Discover obsolete seed data + migrations from abandoned experiments

**Files:** scan-only

- [ ] **Step 1: Inspect `scripts/seed-platform-knowledge.ts`**

If it exists, check whether it points to live AVA / search collections. If the data it seeds references modules being deleted in this Stream, mark for deletion.

- [ ] **Step 2: Inspect navigation seed migrations**

```
git ls-files migrations/instance/ | xargs grep -lE "INSERT INTO .*nav" 2>/dev/null
```

For each result: identify rows pointing to deleted modules. Two options for each:
1. Author a follow-up migration that DELETEs the stale rows.
2. Adjust the originating migration if it has not yet shipped (rare — most are committed history).

Default: author a follow-up migration; never rewrite shipped history.

- [ ] **Step 3: Record findings**

`/tmp/prelude-stream3-seed-candidates.md`.

### Task 24: Discover repository hygiene violations

**Files:** scan-only

- [ ] **Step 1: Find `.bak`, `.old`, `.tmp`, `.disabled` files**

```
git ls-files | grep -E '\\.(bak|old|tmp|disabled)$' || echo "(none)"
```

Untracked variants:
```
find . -name "*.bak" -o -name "*.old" -o -name "*.tmp" -o -name "*.disabled" 2>/dev/null | grep -v node_modules | grep -v dist | grep -v .git
```

- [ ] **Step 2: Find commented-out implementations**

```
git grep -nE "^\\s*//\\s*(class|function|interface|export)\\s" -- '*.ts'
```

(Heuristic. Result needs human review — some commented blocks are dead code, some are illustrative comments.)

- [ ] **Step 3: Find dead env vars in `.env.example` and `scripts/setup.ts`**

```
# List every env var defined in .env.example
grep -oE '^[A-Z_]+(?==)' .env.example | sort -u > /tmp/env-vars.txt
# For each, check if it's referenced anywhere in the codebase
while read v; do
  count=$(git grep -l "process\\.env\\.${v}\\b\\|configService\\.get\\(['\"]${v}['\"]" | wc -l)
  if [ "$count" = "0" ]; then echo "DEAD: $v"; fi
done < /tmp/env-vars.txt
```

Same check for `scripts/setup.ts`.

- [ ] **Step 4: Find dead docker-compose services**

For each service in `docker-compose.yml`, check whether it's used by any running script / referenced by the setup. Common candidates: services for tools never integrated.

- [ ] **Step 5: Record findings**

`/tmp/prelude-stream3-hygiene-candidates.md`.

### Task 25: Assemble deletion ledger PR and present to user

**Files:**
- Create: `docs/superpowers/plans/2026-05-14-phase3-prelude-stream3-deletion-ledger.md` (proposed deletion list, awaiting user approval)

- [ ] **Step 1: Aggregate all candidate findings from Tasks 20–24**

Concatenate `/tmp/prelude-stream3-*-candidates.md` into a single ledger document.

- [ ] **Step 2: Structure the ledger by category**

Create `docs/superpowers/plans/2026-05-14-phase3-prelude-stream3-deletion-ledger.md` with sections:

```markdown
# Phase 3 Prelude Stream 3 — Deletion Ledger (Proposed)

Each entry includes: target path, rationale, replacement state.
Pending: user approval. Nothing in this ledger is deleted until approved.

## Backend modules / controllers / DTOs

- [ ] `apps/svc-automation/` (and 10 sibling `apps/svc-*` directories)
  - Rationale: Phase 1 thin-adapter leftovers; replaced by modular monolith at `apps/api`. Tag `arc-w1-complete` removed them from tracked history; on-disk copies are local-only artifacts.
  - Replacement state: `apps/api/src/app/{automation,ava,data,identity,insights,instance-api,metadata,notifications,views,workflow}/`.
- [ ] `apps/api/src/app/instance-api/identity/auth/identity-auth-alias.controller.ts` — **CONDITIONAL**
  - Rationale: Vite proxy strip rewrites make this alias redundant during dev. The canonical `AuthController` at `@Controller('auth')` handles `/api/identity/auth/login` once the proxy strips `/identity`.
  - Replacement state: `apps/api/src/app/identity/auth/auth.controller.ts` (canonical handler).
  - **CAVEAT:** If deleted, the Vite proxy strip becomes load-bearing for `/api/identity/auth/login`. Direct API hits at `http://localhost:3000/api/identity/auth/login` will 404 instead of working. Task 19's dual-route validation will fail unless rewritten to go through the proxy (port 4200) instead of apps/api directly. **Recommendation: defer this deletion to W3 (when frontend `VITE_*_API_URL` defaults are aligned with apps/api's URL space).** Approve only if you're explicitly OK with the load-bearing proxy.
- [ ] (other backend candidates from Task 20)

## Frontend surfaces

(populate from Task 21 findings)

## Navigation / actions / feature flags

(populate from Task 22 findings)

## Seed data + follow-up migrations

(populate from Task 23 findings)

## Repository hygiene

(populate from Task 24 findings)
```

Every entry must include rationale + replacement state (or "no replacement; surface is genuinely removed from product"). Entries without both fields are not deletion candidates yet.

- [ ] **Step 3: Commit the ledger as a proposal**

```
git add docs/superpowers/plans/2026-05-14-phase3-prelude-stream3-deletion-ledger.md
git commit -m "phase3-prelude: propose Stream 3 deletion ledger"
```

### Task 26: USER APPROVAL GATE — wait for ledger approval

**This is a real workflow stop. Do not proceed past this task until the user reviews and approves the deletion ledger.**

- [ ] **Step 1: Surface the ledger file path to the user**

Message: "Stream 3 deletion ledger drafted at `docs/superpowers/plans/2026-05-14-phase3-prelude-stream3-deletion-ledger.md`. Please review each entry. Reply with approvals/rejections per category (or per item if more granular). Nothing is deleted until you approve."

- [ ] **Step 2: Wait**

Do not delete anything. Do not proceed to Task 27.

- [ ] **Step 3: On user approval, update the ledger**

Mark approved entries' checkboxes `[x]`. Rejected entries: remove from ledger with a brief note. Re-commit the updated ledger:

```
git add docs/superpowers/plans/2026-05-14-phase3-prelude-stream3-deletion-ledger.md
git commit -m "phase3-prelude: finalize approved Stream 3 deletion ledger"
```

### Task 27: Execute approved deletions in one atomic commit

**Files:** every approved deletion candidate

- [ ] **Step 1: Re-read the approved ledger**

Identify every `[x]` checkbox in the finalized ledger.

- [ ] **Step 2: Execute deletions**

For each approved item:
- If it's a tracked file: `git rm <path>`.
- If it's untracked on disk: `rm -rf <path>`.
- If it's a navigation/seed row in a tracked migration: author a follow-up migration that DELETEs the row (never rewrite shipped history).
- If it's a dead env var: remove the line from `.env.example` and the generation logic in `scripts/setup.ts`.
- If it's a dead docker-compose service: remove the service block from `docker-compose.yml`.
- If it's a feature flag reference: remove every branch that references the flag (since the flag is being declared abandoned).

- [ ] **Step 3: Verify the post-deletion state (deletion safety rule)**

The deletion safety rule binds this step. ALL FOUR sub-checks must pass before the commit lands:

```bash
# (a) Repository hygiene — no leftover tracked .bak/.old/.tmp/.disabled
git ls-files | grep -E '\.(bak|old|tmp|disabled)$' || echo "(no hygiene violations)"

# (b) Cross-reference grep — no leftover references to deleted symbols
# Replace <deleted-module-names> with each unique symbol/class from the ledger
for mod in <deleted-module-names>; do
  count=$(git grep -l "$mod" | wc -l)
  if [ "$count" -gt "0" ]; then echo "FAIL: $mod has $count remaining references"; fi
done

# (c) TypeScript build clean
npx nx run-many --target=build --projects=api,control-plane,worker,web-client --skip-nx-cache 2>&1 | tail -10

# (d) All scanners pass
npm run entity-schema:check && \
npm run cross-domain:check && \
npm run migration-filename:check && \
npm run abac-coverage:check
```

Expected:
- (a) no tracked hygiene files.
- (b) zero remaining references.
- (c) every build succeeds.
- (d) every scanner exits 0.

If any check fails, the deletion violates the safety rule — DO NOT COMMIT. Either restore the deleted surface OR delete the dangling reference too. Re-run all four checks before the commit.

- [ ] **Step 4: Dual-route smoke (only if the alias controller deletion was approved)**

If the ledger approved the `identity-auth-alias.controller.ts` deletion, the `/api/identity/auth/login` route now only works through the Vite proxy strip. Validate:

```bash
npm run dev:platform &
DEV_PID=$!
for i in $(seq 1 60); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4200/ 2>/dev/null)
  if [ "$CODE" = "200" ]; then break; fi
  sleep 2
done
PW=$(grep '^ADMIN_PASSWORD=' .env | cut -d= -f2-)
BODY="{\"username\":\"admin@hubblewave.local\",\"password\":\"$PW\",\"instanceSlug\":\"default\"}"
# Via proxy — should work
curl -s -o /dev/null -w "via proxy: %{http_code}\n" -X POST http://localhost:4200/api/identity/auth/login -H "Content-Type: application/json" -d "$BODY"
# Direct — should now 404 (alias deleted)
curl -s -o /dev/null -w "direct: %{http_code}\n" -X POST http://localhost:3000/api/identity/auth/login -H "Content-Type: application/json" -d "$BODY"
kill $DEV_PID 2>/dev/null || true
```

Expected if alias was approved-for-deletion: `via proxy: 201`, `direct: 404`. If both still return 201, the alias wasn't deleted (acceptable per ledger).

- [ ] **Step 5: Atomic commit**

```
git commit -m "phase3-prelude: remove obsolete product surfaces"
```

This is the deletion commit standardized in the spec.

---

## Stream 4 — Validation Harness + CI Enforcement

**Stream goal:** Author `scripts/prelude-validate.ts` (happy path + negative cases). Wire it + every Prelude scanner into CI as required status checks. Run the harness end-to-end against a clean DB and verify all four DoD criteria hold.

**Stream exit gate:** Final `prelude-validate.ts` run is green on a fresh DB rebuild. CI required checks include `prelude-validate` and every Prelude scanner. DoD criteria 1–4 all true. PLATFORM-ROADMAP.md updated to point at this spec as governing baseline.

**Decomposition:**
- Tasks 28–30 are **Mechanical** (harness creation; happy path + negative cases).
- Tasks 31–32 are **CI / Scanner** (CI wiring + status check configuration).
- Task 33 is **Architectural Validation** (final exit-criterion verification).
- Task 34 is **Mechanical** (roadmap update + Prelude close).

### Task 28: Create `scripts/prelude-validate.ts` skeleton

**Files:**
- Create: `scripts/prelude-validate.ts`

- [ ] **Step 1: Skeleton with structured assertion framework**

Create `scripts/prelude-validate.ts`:

```ts
#!/usr/bin/env tsx
/**
 * Phase 3 Prelude validation harness.
 *
 * Validates the Prelude exit criterion end-to-end:
 *   "Fresh database boot produces only valid platform experiences and a
 *    deterministic runtime baseline."
 *
 * Happy path AND negative cases are asserted. Failure on any case exits 1.
 *
 * Usage:
 *   npx tsx scripts/prelude-validate.ts            # full run
 *   npx tsx scripts/prelude-validate.ts --skip-rebuild  # skip docker-compose down -v
 */
import { execSync } from 'child_process';

interface Assertion { name: string; run: () => Promise<{ ok: boolean; detail?: string }> }
const assertions: Assertion[] = [];
function assert(name: string, run: Assertion['run']) { assertions.push({ name, run }); }

function sh(cmd: string, opts: { allowFail?: boolean } = {}): { code: number; stdout: string; stderr: string } {
  try {
    const stdout = execSync(cmd, { encoding: 'utf8', stdio: ['inherit', 'pipe', 'pipe'] });
    return { code: 0, stdout, stderr: '' };
  } catch (e: any) {
    if (!opts.allowFail) throw e;
    return { code: e.status ?? 1, stdout: e.stdout?.toString() ?? '', stderr: e.stderr?.toString() ?? '' };
  }
}

// Assertions defined in Tasks 29 and 30 below.

async function main() {
  const skipRebuild = process.argv.includes('--skip-rebuild');
  if (!skipRebuild) {
    console.log('▶ Tearing down + rebuilding fresh DB...');
    sh('docker-compose down -v');
    sh('docker-compose up -d');
    console.log('▶ Waiting for services...');
    sh('sleep 15');
    sh('npm run migration:run:control-plane');
    sh('npm run migration:run:instance');
    sh('npx tsx scripts/seed-admin-user.ts');
  }
  const results: { name: string; ok: boolean; detail?: string }[] = [];
  for (const a of assertions) {
    process.stdout.write(`  ${a.name}... `);
    try { const r = await a.run(); results.push({ name: a.name, ...r }); process.stdout.write(r.ok ? 'PASS\n' : `FAIL — ${r.detail ?? ''}\n`); }
    catch (e: any) { results.push({ name: a.name, ok: false, detail: e?.message ?? String(e) }); process.stdout.write(`FAIL — ${e?.message}\n`); }
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} assertions passed.`);
  if (failed.length > 0) {
    console.log('Failed:');
    for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Add npm script**

Edit `package.json`:
```json
"prelude:validate": "npx tsx scripts/prelude-validate.ts"
```

- [ ] **Step 3: Stage (commit folds into Task 30)**

```
git add scripts/prelude-validate.ts package.json
```

### Task 29: Implement happy-path assertions

**Files:**
- Modify: `scripts/prelude-validate.ts`

- [ ] **Step 1: Add the apps/api startup + login assertions**

Insert before `async function main` in `scripts/prelude-validate.ts`:

```ts
assert('apps/api boots without ERROR/WARN from transitional bridges', async () => {
  // Start apps/api in background, wait, check log for forbidden patterns.
  const ps = require('child_process').spawn('npm', ['run', 'dev:api'], { stdio: ['ignore', 'pipe', 'pipe'] });
  let buf = '';
  ps.stdout.on('data', (d: Buffer) => { buf += d.toString(); });
  ps.stderr.on('data', (d: Buffer) => { buf += d.toString(); });
  // Poll for "Nest application successfully started" or timeout
  for (let i = 0; i < 60; i++) {
    if (buf.includes('Nest application successfully started')) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  if (!buf.includes('Nest application successfully started')) { ps.kill(); return { ok: false, detail: 'apps/api did not start within 60s' }; }
  // Forbidden patterns in startup log
  const forbidden = ['ERROR', 'UnhandledPromiseRejection', 'unannotated endpoint passed through'];
  const violations = forbidden.filter((p) => buf.includes(p));
  ps.kill();
  return violations.length === 0 ? { ok: true } : { ok: false, detail: `forbidden patterns in startup log: ${violations.join(', ')}` };
});

assert('login via /api/auth/login returns valid ES256 JWT', async () => {
  const PW = require('fs').readFileSync('.env', 'utf8').split('\n').find((l: string) => l.startsWith('ADMIN_PASSWORD='))?.split('=')[1];
  if (!PW) return { ok: false, detail: 'ADMIN_PASSWORD missing' };
  const body = JSON.stringify({ username: 'admin@hubblewave.local', password: PW, instanceSlug: 'default' });
  const r = sh(`curl -s -o /tmp/login.json -w "%{http_code}" -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '${body}'`);
  if (r.stdout.trim() !== '201') return { ok: false, detail: `expected 201, got ${r.stdout}` };
  const resp = JSON.parse(require('fs').readFileSync('/tmp/login.json', 'utf8'));
  if (!resp.accessToken?.startsWith('eyJ')) return { ok: false, detail: 'no valid JWT in response' };
  // Verify header alg is ES256
  const header = JSON.parse(Buffer.from(resp.accessToken.split('.')[0], 'base64url').toString());
  return header.alg === 'ES256' ? { ok: true } : { ok: false, detail: `expected alg=ES256, got ${header.alg}` };
});

assert('login via /api/identity/auth/login also returns valid JWT (alias route)', async () => {
  const PW = require('fs').readFileSync('.env', 'utf8').split('\n').find((l: string) => l.startsWith('ADMIN_PASSWORD='))?.split('=')[1];
  const body = JSON.stringify({ username: 'admin@hubblewave.local', password: PW, instanceSlug: 'default' });
  const r = sh(`curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/identity/auth/login -H "Content-Type: application/json" -d '${body}'`);
  return r.stdout.trim() === '201' ? { ok: true } : { ok: false, detail: `expected 201, got ${r.stdout}` };
});

assert('GET /api/users returns 200 with admin token', async () => {
  const token = JSON.parse(require('fs').readFileSync('/tmp/login.json', 'utf8')).accessToken;
  const r = sh(`curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/users?pageSize=1 -H "Authorization: Bearer ${token}"`);
  return r.stdout.trim() === '200' ? { ok: true } : { ok: false, detail: `expected 200, got ${r.stdout}` };
});

assert('GET /api/health returns 200', async () => {
  const r = sh(`curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health`);
  return r.stdout.trim() === '200' ? { ok: true } : { ok: false, detail: `expected 200, got ${r.stdout}` };
});
```

- [ ] **Step 2: Stage (commit folds into Task 30)**

### Task 30: Implement negative-case assertions + commit harness

**Files:**
- Modify: `scripts/prelude-validate.ts`

- [ ] **Step 1: Add negative-case assertions**

Insert after the happy-path assertions:

```ts
assert('unauthorized GET /api/users returns 401', async () => {
  const r = sh(`curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/users`);
  return r.stdout.trim() === '401' ? { ok: true } : { ok: false, detail: `expected 401, got ${r.stdout}` };
});

assert('nonexistent route returns 404 (not 500)', async () => {
  const r = sh(`curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/this-route-does-not-exist-2026`);
  return r.stdout.trim() === '404' ? { ok: true } : { ok: false, detail: `expected 404, got ${r.stdout}` };
});

assert('navigation seed contains no rows pointing to deleted modules', async () => {
  const r = sh(`docker exec hw_postgres psql -U hubblewave -d hubblewave -t -c "SELECT count(*) FROM identity.nav_profile_items WHERE route LIKE '/phase7%' OR route LIKE '%/legacy/%'"`, { allowFail: true });
  const count = parseInt(r.stdout.trim(), 10);
  return count === 0 ? { ok: true } : { ok: false, detail: `${count} stale nav rows found` };
});

assert('no `.bak`/`.old`/`.tmp`/`.disabled` tracked files', async () => {
  const r = sh(`git ls-files | grep -E '\\.(bak|old|tmp|disabled)$' || true`, { allowFail: true });
  return r.stdout.trim() === '' ? { ok: true } : { ok: false, detail: `tracked hygiene files: ${r.stdout.trim().split('\n').join(', ')}` };
});

assert('no `search_path` reference in runtime code', async () => {
  const r = sh(`git grep "search_path" -- '*.ts' ':!docs/' ':!migrations/' || true`, { allowFail: true });
  return r.stdout.trim() === '' ? { ok: true } : { ok: false, detail: `search_path still referenced: ${r.stdout.trim().split('\n')[0]}` };
});

assert('all Prelude scanners exit 0', async () => {
  const scanners = ['entity-schema:check', 'cross-domain:check', 'migration-filename:check', 'abac-coverage:check'];
  for (const s of scanners) {
    const r = sh(`npm run ${s} --silent`, { allowFail: true });
    if (r.code !== 0) return { ok: false, detail: `${s} exited non-zero` };
  }
  return { ok: true };
});
```

- [ ] **Step 2: Run the harness against current state**

```
npx tsx scripts/prelude-validate.ts
```

Expected: all assertions pass.

- [ ] **Step 3: Commit the harness**

```
git add scripts/prelude-validate.ts package.json
git commit -m "phase3-prelude: introduce prelude-validate harness"
```

### Task 31: Wire `prelude-validate.ts` into GitHub Actions

**Files:**
- Modify: `.github/workflows/ci.yml` (or create a new workflow file if appropriate)

- [ ] **Step 1: Inspect current CI workflow**

```
cat .github/workflows/ci.yml | head -60
```

- [ ] **Step 2: Add a new job for the prelude harness**

**CI trigger note:** `contains(github.event.pull_request.changed_files.*.filename, …)` is NOT valid GitHub Actions syntax. Use one of these two valid approaches — pick what the repo already uses elsewhere:

**Option A: Path-based workflow trigger** (simpler; runs the whole workflow when matching paths change):

```yaml
on:
  pull_request:
    paths:
      - 'migrations/**'
      - 'libs/instance-db/**'
      - '**/*.entity.ts'
      - 'apps/api/src/app/identity/auth/guards/**'
      - 'tools/scanners/**'
      - 'scripts/prelude-validate.ts'
  push:
    branches: [master]
```

**Option B: Changed-files action** (per-job conditional; allows multiple jobs in one workflow with different triggers):

```yaml
      - id: changed
        uses: tj-actions/changed-files@v44
        with:
          files: |
            migrations/**
            libs/instance-db/**
            **/*.entity.ts
            apps/api/src/app/identity/auth/guards/**
            tools/scanners/**
            scripts/prelude-validate.ts
      - if: steps.changed.outputs.any_changed == 'true'
        run: npm run prelude:validate -- --skip-rebuild
```

Pick whichever matches the existing `.github/workflows/ci.yml` convention. Job body itself:

```yaml
  prelude-validate:
    name: Phase 3 Prelude — validation harness
    runs-on: ubuntu-latest
    services:
      postgres:
        image: pgvector/pgvector:pg16
        env:
          POSTGRES_USER: hubblewave
          POSTGRES_PASSWORD: hubblewave
          POSTGRES_DB: hubblewave
        ports: ['5432:5432']
        options: --health-cmd pg_isready --health-interval 10s --health-timeout 5s --health-retries 5
      redis:
        image: redis:7
        ports: ['6379:6379']
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run prelude:validate -- --skip-rebuild
        env:
          DB_HOST: localhost
          DB_PORT: 5432
          DB_USER: hubblewave
          DB_PASSWORD: hubblewave
          DB_NAME: hubblewave
          REDIS_HOST: localhost
          NODE_ENV: development
          JWT_KEY_PROVIDER: local-es256
          JWT_BOOTSTRAP_SECRET: ci-bootstrap-secret
          API_PORT: 3000
          ADMIN_EMAIL: admin@hubblewave.local
          ADMIN_PASSWORD: ci-admin-password
          ADMIN_FIRST_NAME: HubbleWave
          ADMIN_LAST_NAME: Admin
```

Validate the YAML with `actionlint` if available; otherwise visually verify it parses by inspecting the GitHub Actions tab after push. Do not commit invalid workflow logic — re-check syntax until the runner accepts it.

- [ ] **Step 3: Commit**

```
git add .github/workflows/ci.yml
git commit -m "phase3-prelude: wire prelude-validate into CI"
```

### Task 32: Add every Prelude scanner as a required status check

**Files:**
- Modify: `.github/workflows/ci.yml` (extend existing scanner job OR add new)

- [ ] **Step 1: Inspect current "Architectural CI gates" job**

The existing CI already runs scanners like `authz:check`, `audit:check`, etc. Locate that job in `.github/workflows/ci.yml`.

- [ ] **Step 2: Add the 5 new Prelude scanner steps**

Within the existing scanner job, add steps:

```yaml
      - name: entity-schema-ownership-check
        run: npm run entity-schema:check
      - name: cross-domain-import-check
        run: npm run cross-domain:check
      - name: migration-filename-check
        run: npm run migration-filename:check
      - name: permissions-annotation-coverage (report only — no fail)
        run: npm run permissions-coverage:check
      - name: abac-coverage-check
        run: npm run abac-coverage:check
```

- [ ] **Step 3: Add self-test steps**

```yaml
      - name: scanner self-tests (Prelude)
        run: |
          npx tsx tools/scanners/entity-schema-ownership-check-selftest.ts && \
          npx tsx tools/scanners/cross-domain-import-check-selftest.ts && \
          npx tsx tools/scanners/migration-filename-check-selftest.ts && \
          npx tsx tools/scanners/permissions-annotation-coverage-selftest.ts && \
          npx tsx tools/scanners/abac-coverage-check-selftest.ts
```

- [ ] **Step 4: Verify the workflow file is syntactically valid**

```
# If actionlint is available
actionlint .github/workflows/ci.yml || echo "actionlint not present; manual review needed"
```

- [ ] **Step 5: Commit**

```
git add .github/workflows/ci.yml
git commit -m "phase3-prelude: wire Prelude scanners as required CI status checks"
```

### Task 33: Final Prelude exit-criterion verification

**Files:** none (verification only)

- [ ] **Step 1: Fresh-DB end-to-end run**

```
npx tsx scripts/prelude-validate.ts
```

Expected: every assertion passes.

- [ ] **Step 2: Verify DoD criterion 1 — fresh-DB validation script succeeds**

Step 1's output IS the DoD #1 evidence.

- [ ] **Step 3: Verify DoD criterion 2 — no Prelude-scoped allowlist entries remain**

Inspect every `tools/*.ts` and `tools/scanners/*-allowlist.json` for entries that should have been closed by Prelude. Anything with `followUp: 'Prelude'` or earlier must be empty.

```
git grep -nE "followUp.*['\"]Prelude['\"]" tools/
```

Expected: zero matches.

- [ ] **Step 4: Verify DoD criterion 3 — no uncommitted Phase 1/2 artifacts**

```
git status --short
```

Expected: clean working tree (or only Stream 4 staged changes about to be committed).

- [ ] **Step 5: Verify DoD criterion 4 — Section 1 exit criterion holds**

Combination of: scanners pass + fresh DB build + login works + no WARN-level transitional lines unrelated to annotation rollout. Steps 1–4 cover this.

### Task 34: Update PLATFORM-ROADMAP.md + close Prelude

**Files:**
- Modify: `docs/superpowers/PLATFORM-ROADMAP.md`

- [ ] **Step 1: Update the roadmap to reference the frozen Phase 3 spec**

Open `docs/superpowers/PLATFORM-ROADMAP.md`. Add (or update) a section near the top:

```markdown
## Phase 3 governance baseline

The Phase 3 roadmap is governed by `docs/superpowers/specs/2026-05-14-phase3-roadmap-and-prelude-design.md`. That document supersedes the "Phase 3" section in the legacy roadmap below. Update sequencing decisions, exit criteria, and scope changes there — not here.
```

Update the "Last updated" line at the top.

- [ ] **Step 2: Update RESUME-CONTEXT.md to reflect Prelude completion**

Open `docs/superpowers/RESUME-CONTEXT.md`. Add a "Phase 3 Prelude" entry to the completed-work table.

- [ ] **Step 3: Final commit**

```
git add docs/superpowers/PLATFORM-ROADMAP.md docs/superpowers/RESUME-CONTEXT.md
git commit -m "phase3-prelude: update roadmap + resume context for Prelude close"
```

- [ ] **Step 4: Run the harness one final time end-to-end**

```
npx tsx scripts/prelude-validate.ts
```

Expected: all assertions pass.

- [ ] **Step 5: Tag the Prelude completion**

```
git tag -a phase3-prelude-complete -m "Phase 3 Prelude complete — clean foundation established."
```

Phase 3 Prelude done. W2 (Platform Integrity) is next; brainstorm + spec + plan that wave in its own cycle.

---

## Rollback policy

Atomic commits without rollback discipline can leave master in worse shape than before. The two high-blast-radius commits in this plan are required to be cleanly revertable:

- **Stream 1 atomic commit** (`phase3-prelude: finalize schema split and remove runtime bridge`) MUST revert cleanly via a single `git revert <sha>`. The revert restores the `search_path` bridge, drops the entity decorator updates, and un-stages the new migrations. After revert, fresh DB rebuild + login must work (i.e. the codebase returns to pre-Stream-1 functional state). If during execution any sub-step requires manual data-fix-up to revert, the commit is too coupled — split into a follow-up commit instead.
- **Stream 3 deletion commit** (`phase3-prelude: remove obsolete product surfaces`) MUST revert cleanly via a single `git revert <sha>`. The revert restores every deleted file at its pre-deletion content. Database state (if the deletion authored a follow-up migration that DELETEd seed rows) is restored by running the follow-up migration's `down()`. No manual `psql` should be required.
- **All other Prelude commits** (scanners, harness, CI wiring) are small enough that revert is mechanical.

**Prelude never leaves master in a partially-transitioned schema state.** If a Stream 1 step fails halfway, the partial state stays in the working tree as uncommitted changes — it does not get committed to master. The atomic commit lands only when the full Stream 1 verification (Task 9 Step 3 + Step 4) passes.

**Rollback authority:** the engineer executing the plan may revert any Prelude commit that violates these constraints without escalation. Reverts use the same `phase3-prelude:` prefix: e.g. `phase3-prelude: revert finalize schema split (broken on fresh-DB rebuild)`.

---

## Plan-wide notes

**Commit prefix:** every commit uses `phase3-prelude:` (lowercase, hyphenated). Standardized atomic-commit messages used: Stream 1 = `phase3-prelude: finalize schema split and remove runtime bridge`; Stream 3 = `phase3-prelude: remove obsolete product surfaces`.

**Cross-wave rule violations:** any time a task can't complete inside the preservation boundaries (canonical API contracts, Phase 2 auth direction, modular monolith topology, W2–W5 sequencing), it gets escalated to the user with `phase3-prelude: VIOLATION — needs founder approval` and the PR documents the rationale.

**Freeze rule:** any non-Prelude PR opened during the wave is labeled `prelude-freeze-queued` and held in draft until Prelude's tag lands.

**Scanner conventions:** every scanner introduced by this plan lives under `tools/scanners/`, exits non-zero on violation, supports `--ci` for JSON output, and ships with a self-test. Allowlists require `rationale` + `addedBy` + `addedAt` per entry. Prelude scanners become permanent CI gates unless explicitly retired in a documented amendment.
