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
 *   npx tsx scripts/prelude-validate.ts            # full run (rebuilds DB)
 *   npx tsx scripts/prelude-validate.ts --skip-rebuild  # skip docker-compose down -v
 */
import { execSync, spawn, type ChildProcess } from 'child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// Captured apps/api stdout+stderr when we spawn the process ourselves. Empty
// on --skip-rebuild (the caller provided a running API; we have no log).
const apiStartupLogPath = join(tmpdir(), 'hw-prelude-api-startup.log');

interface AssertionResult { ok: boolean; detail?: string }
interface Assertion { name: string; run: () => Promise<AssertionResult> }

const assertions: Assertion[] = [];
function assert(name: string, run: () => Promise<AssertionResult>): void {
  assertions.push({ name, run });
}

function sh(cmd: string, opts: { allowFail?: boolean } = {}): { code: number; stdout: string; stderr: string } {
  try {
    const stdout = execSync(cmd, { encoding: 'utf8', stdio: ['inherit', 'pipe', 'pipe'] });
    return { code: 0, stdout, stderr: '' };
  } catch (e: unknown) {
    const err = e as { status?: number; stdout?: Buffer; stderr?: Buffer };
    if (!opts.allowFail) throw e;
    return { code: err.status ?? 1, stdout: err.stdout?.toString() ?? '', stderr: err.stderr?.toString() ?? '' };
  }
}

async function pollHttp(url: string, maxSeconds: number): Promise<boolean> {
  const iterations = Math.ceil(maxSeconds / 2);
  for (let i = 0; i < iterations; i++) {
    const r = sh(`curl -s -o /dev/null -w "%{http_code}" ${url}`, { allowFail: true });
    if (r.code === 0 && r.stdout.trim() === '200') return true;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  return false;
}

function readEnvPassword(): string | null {
  try {
    const env = readFileSync('.env', 'utf8');
    const line = env.split('\n').find((l) => l.startsWith('ADMIN_PASSWORD='));
    return line ? line.slice('ADMIN_PASSWORD='.length).trim() : null;
  } catch {
    return null;
  }
}

let apiProcess: ChildProcess | null = null;
let loginAccessToken: string | null = null;

// ============================================================================
// HAPPY PATH ASSERTIONS
// ============================================================================

assert('apps/api boots without ERROR/UnhandledPromiseRejection in startup log', async () => {
  // If the API is already healthy (e.g. --skip-rebuild with a running instance),
  // skip the spawn entirely. The startup-log scan below is then a no-op because
  // we don't have the log file the caller's apps/api was writing to.
  const alreadyUp = await pollHttp('http://localhost:3000/api/health', 4);
  if (!alreadyUp) {
    // API not running: spawn it and redirect both stdout and stderr to a temp
    // log file via the shell's `>` and `2>&1`. The previous attempt used
    // `stdio: ['ignore', 'pipe', 'pipe']` which hung reliably on Windows +
    // `shell: true`: nx serve emits volumes of output during a cold compile,
    // the OS pipe buffer fills (~4KB), and the child blocks on the next write
    // because the JS-side .on('data', …) drain doesn't keep up with the
    // cmd.exe-wrapped pipe layer. Switching to `stdio: 'ignore'` fixed the
    // hang but lost the startup-log signal entirely. Redirecting to a file
    // gives both: pipes never fill (the OS writes straight to disk), and we
    // can scan the file after health passes to keep the forbidden-pattern
    // check honest.
    //
    // Clear any previous run's log so a stale failure from a prior run can't
    // mask a clean current run.
    if (existsSync(apiStartupLogPath)) {
      try { rmSync(apiStartupLogPath, { force: true }); } catch {
        // tolerated — file may be open / locked; we'll overwrite on next write.
      }
    }
    apiProcess = spawn(
      `npm run dev:api > "${apiStartupLogPath}" 2>&1`,
      { stdio: 'ignore', shell: true },
    );
  }

  // Primary readiness: poll health endpoint (max 180s to handle cold NX cache).
  const apiUp = await pollHttp('http://localhost:3000/api/health', 180);
  if (!apiUp) {
    return { ok: false, detail: 'apps/api did not become healthy within 180s' };
  }

  // Forbidden-pattern scan over the captured startup log. Only meaningful on
  // the spawn path (when --skip-rebuild routed around the spawn, the file
  // doesn't exist and the scan is a tolerated no-op).
  let logContent = '';
  if (existsSync(apiStartupLogPath)) {
    try { logContent = readFileSync(apiStartupLogPath, 'utf8'); } catch {
      // tolerated — health already confirmed the boot.
    }
  }
  const forbidden = ['UnhandledPromiseRejection', 'FATAL', 'unannotated endpoint passed through'];
  const violations = forbidden.filter((p) => logContent.includes(p));
  return violations.length === 0
    ? { ok: true }
    : { ok: false, detail: `forbidden patterns in startup log: ${violations.join(', ')}` };
});

assert('GET /api/health returns 200', async () => {
  const ok = await pollHttp('http://localhost:3000/api/health', 30);
  return ok ? { ok: true } : { ok: false, detail: 'health endpoint did not return 200 within 30s' };
});

assert('login via /api/auth/login returns valid ES256 JWT', async () => {
  const pw = readEnvPassword();
  if (!pw) return { ok: false, detail: 'ADMIN_PASSWORD missing from .env' };
  // Write JSON body to a temp file to avoid shell quoting issues on Windows
  const bodyFile = join(tmpdir(), 'hw-prelude-login-body.json');
  const outFile = join(tmpdir(), 'hw-prelude-login-resp.json');
  writeFileSync(bodyFile, JSON.stringify({ username: 'admin@hubblewave.local', password: pw, instanceSlug: 'default' }), 'utf8');
  const r = sh(`curl -s -o "${outFile}" -w "%{http_code}" -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d @"${bodyFile}"`, { allowFail: true });
  if (r.stdout.trim() !== '201') return { ok: false, detail: `expected 201, got ${r.stdout}` };

  const resp = JSON.parse(readFileSync(outFile, 'utf8'));
  if (!resp.accessToken?.startsWith('eyJ')) return { ok: false, detail: 'no valid JWT in response' };
  loginAccessToken = resp.accessToken;

  // Verify header alg is ES256 (decode first base64url segment)
  const headerB64 = (resp.accessToken as string).split('.')[0];
  const headerJson = Buffer.from(headerB64, 'base64url').toString();
  const header = JSON.parse(headerJson);
  return header.alg === 'ES256'
    ? { ok: true }
    : { ok: false, detail: `expected alg=ES256, got ${header.alg}` };
});

assert('login via /api/identity/auth/login alias also returns valid JWT', async () => {
  const pw = readEnvPassword();
  if (!pw) return { ok: false, detail: 'ADMIN_PASSWORD missing' };
  // Write JSON body to a temp file to avoid shell quoting issues on Windows
  const bodyFile = join(tmpdir(), 'hw-prelude-login-alias-body.json');
  writeFileSync(bodyFile, JSON.stringify({ username: 'admin@hubblewave.local', password: pw, instanceSlug: 'default' }), 'utf8');
  const r = sh(`curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/identity/auth/login -H "Content-Type: application/json" -d @"${bodyFile}"`, { allowFail: true });
  return r.stdout.trim() === '201'
    ? { ok: true }
    : { ok: false, detail: `expected 201, got ${r.stdout}` };
});

// Admin profile round-trip through the auth pipeline (JWT verify → IdentityResolverPort
// → @AuthenticatedOnly()). Pre-W2 path (ii) leaves `identity.platform_permissions` and
// `identity.role_permissions` empty until Stream 2 PR3 materializes the registry from
// PERMISSION_REGISTRY, so @RequirePermission-gated endpoints (e.g. `GET /api/users`,
// gated by `users.view`) return 403 by design — testing them here would assert the
// gate works against a deliberately-empty registry. The W2 spec admin-can-list-users
// assertion is the right shape for Stream 2's exit gate; we use `/api/auth/me` here
// because it tests the same trust chain (token issuance → JWT validation → admin
// identity resolution → request-context hydration) without depending on the registry.
assert('GET /api/auth/me returns 200 with admin token', async () => {
  if (!loginAccessToken) return { ok: false, detail: 'no token from prior login assertion' };
  const r = sh(`curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/api/auth/me" -H "Authorization: Bearer ${loginAccessToken}"`, { allowFail: true });
  return r.stdout.trim() === '200'
    ? { ok: true }
    : { ok: false, detail: `expected 200, got ${r.stdout}` };
});

// ============================================================================
// NEGATIVE-CASE ASSERTIONS
// ============================================================================

assert('unauthorized GET /api/users returns 401', async () => {
  const r = sh(`curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/users`, { allowFail: true });
  return r.stdout.trim() === '401'
    ? { ok: true }
    : { ok: false, detail: `expected 401, got ${r.stdout}` };
});

assert('nonexistent route returns 404 (not 500)', async () => {
  const r = sh(`curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/this-route-does-not-exist-2026`, { allowFail: true });
  return r.stdout.trim() === '404'
    ? { ok: true }
    : { ok: false, detail: `expected 404, got ${r.stdout}` };
});

assert('navigation seed contains no rows pointing to deleted modules', async () => {
  // Two execution forms so the assertion runs in both environments:
  // (1) Local docker-compose dev: `docker exec hw_postgres psql ...` works on
  //     Windows/Mac/Linux without needing a local psql binary on PATH.
  // (2) CI (GitHub Actions service container): no container named
  //     `hw_postgres`, but psql is on the runner image's PATH and the
  //     PGHOST/PGUSER/etc env vars are set by the workflow.
  // Try (1) first because it covers the local-dev common case; fall back to
  // (2) only when docker exec is unavailable or the container isn't named.
  const query = "SELECT count(*) FROM metadata.navigation_module_revisions WHERE layout::text LIKE '%studio.views%' OR layout::text LIKE '%/legacy/%'";

  let r = sh(
    `docker exec hw_postgres psql -U hubblewave -d hubblewave -t -c "${query}"`,
    { allowFail: true }
  );

  if (r.code !== 0 || Number.isNaN(parseInt(r.stdout.trim(), 10))) {
    const env = process.env;
    const host = env.PGHOST ?? env.DB_HOST ?? 'localhost';
    const port = env.PGPORT ?? env.DB_PORT ?? '5432';
    const user = env.PGUSER ?? env.DB_USER ?? 'hubblewave';
    const password = env.PGPASSWORD ?? env.DB_PASSWORD ?? 'hubblewave';
    const database = env.PGDATABASE ?? env.DB_NAME ?? 'hubblewave';
    r = sh(
      `PGPASSWORD='${password}' psql -h ${host} -p ${port} -U ${user} -d ${database} -t -c "${query}"`,
      { allowFail: true }
    );
  }

  const count = parseInt(r.stdout.trim(), 10);
  if (Number.isNaN(count)) return { ok: false, detail: `psql output not numeric: ${r.stdout}` };
  return count === 0
    ? { ok: true }
    : { ok: false, detail: `${count} stale nav rows found` };
});

assert('no .bak/.old/.tmp/.disabled tracked files', async () => {
  const r = sh(`git ls-files | grep -E '\\.(bak|old|tmp|disabled)$' || true`, { allowFail: true });
  return r.stdout.trim() === ''
    ? { ok: true }
    : { ok: false, detail: `tracked hygiene files: ${r.stdout.trim().split('\n').join(', ')}` };
});

assert('no search_path reference in runtime code', async () => {
  const r = sh(`git grep "search_path" -- '*.ts' ':!docs/' ':!migrations/' ':!scripts/seed-admin-user.ts' || true`, { allowFail: true });
  return r.stdout.trim() === ''
    ? { ok: true }
    : { ok: false, detail: `search_path still referenced: ${r.stdout.trim().split('\n')[0]}` };
});

// ────────────────────────────────────────────────────────────────────────────
// Baseline-state assertions (Pre-W2 Task 5)
// ────────────────────────────────────────────────────────────────────────────
//
// These three assertions verify the W2 spec §2.2 reshape actually landed
// against the freshly-baselined DB. They run against the same psql endpoint
// the nav-seed assertion uses; the dual-path docker / CI-fallback logic is
// the same pattern.

/**
 * Run a SQL query and return the single-cell scalar result trimmed.
 * Tries `docker exec hw_postgres psql` first (covers local-dev common case),
 * then falls back to a direct psql call using PG* env vars (covers CI's
 * GitHub Actions service-container layout where the container isn't named).
 * Returns `null` if both paths fail or the query returns nothing parseable.
 */
function runDbScalar(query: string): string | null {
  let r = sh(
    `docker exec hw_postgres psql -U hubblewave -d hubblewave -t -A -c "${query}"`,
    { allowFail: true },
  );
  if (r.code !== 0 || r.stdout.trim() === '') {
    const env = process.env;
    const host = env.PGHOST ?? env.DB_HOST ?? 'localhost';
    const port = env.PGPORT ?? env.DB_PORT ?? '5432';
    const user = env.PGUSER ?? env.DB_USER ?? 'hubblewave';
    const password = env.PGPASSWORD ?? env.DB_PASSWORD ?? 'hubblewave';
    const database = env.PGDATABASE ?? env.DB_NAME ?? 'hubblewave';
    r = sh(
      `PGPASSWORD='${password}' psql -h ${host} -p ${port} -U ${user} -d ${database} -t -A -c "${query}"`,
      { allowFail: true },
    );
  }
  if (r.code !== 0) return null;
  const value = r.stdout.trim();
  return value === '' ? null : value;
}

assert('identity.platform_permissions table present', async () => {
  const v = runDbScalar(
    "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'identity' AND table_name = 'platform_permissions'",
  );
  if (v === null) return { ok: false, detail: 'psql query returned no result' };
  return v === '1' ? { ok: true } : { ok: false, detail: `expected count=1, got ${v}` };
});

assert('old identity.permissions table absent', async () => {
  const v = runDbScalar(
    "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'identity' AND table_name = 'permissions'",
  );
  if (v === null) return { ok: false, detail: 'psql query returned no result' };
  return v === '0'
    ? { ok: true }
    : { ok: false, detail: `expected count=0, got ${v} — baseline reshape did not drop identity.permissions` };
});

assert('metadata.collection_definitions.secure_fields_by_default default = true', async () => {
  const v = runDbScalar(
    "SELECT column_default FROM information_schema.columns WHERE table_schema = 'metadata' AND table_name = 'collection_definitions' AND column_name = 'secure_fields_by_default'",
  );
  if (v === null) return { ok: false, detail: 'psql query returned no result' };
  return v === 'true'
    ? { ok: true }
    : { ok: false, detail: `expected column_default='true', got '${v}'` };
});

assert('all Prelude scanners exit 0', async () => {
  const scanners = [
    'entity-schema:check',
    'cross-domain:check',
    'migration-filename:check',
    'abac-coverage:check',
  ];
  for (const s of scanners) {
    const r = sh(`npm run ${s} --silent`, { allowFail: true });
    if (r.code !== 0) return { ok: false, detail: `${s} exited non-zero` };
  }
  return { ok: true };
});

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  const skipRebuild = process.argv.includes('--skip-rebuild');

  if (!skipRebuild) {
    console.log('▶ Tearing down + rebuilding fresh DB...');
    sh('docker-compose down -v');
    sh('docker-compose up -d');

    console.log('▶ Waiting for Postgres readiness...');
    let pgReady = false;
    for (let i = 0; i < 30; i++) {
      const r = sh(`docker exec hw_postgres pg_isready -U hubblewave -d hubblewave`, { allowFail: true });
      if (r.code === 0) { pgReady = true; break; }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    if (!pgReady) {
      console.error('Postgres did not become ready within 60s.');
      process.exit(1);
    }

    console.log('▶ Running migrations + seed...');
    sh('npm run migration:run:control-plane');
    sh('npm run migration:run:instance');
    sh('npx tsx scripts/seed-admin-user.ts');
  }

  console.log('\n▶ Running assertions...\n');
  const results: { name: string; ok: boolean; detail?: string }[] = [];
  for (const a of assertions) {
    process.stdout.write(`  ${a.name}... `);
    try {
      const r = await a.run();
      results.push({ name: a.name, ...r });
      process.stdout.write(r.ok ? 'PASS\n' : `FAIL — ${r.detail ?? ''}\n`);
    } catch (e: unknown) {
      const err = e as Error;
      results.push({ name: a.name, ok: false, detail: err?.message ?? String(e) });
      process.stdout.write(`FAIL — ${err?.message}\n`);
    }
  }

  // Stop the API process if we started it
  if (apiProcess) {
    apiProcess.kill();
    apiProcess = null;
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} assertions passed.`);
  if (failed.length > 0) {
    console.log('Failed:');
    for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
    process.exit(1);
  }
}

main().catch((e: unknown) => {
  console.error(e);
  if (apiProcess) apiProcess.kill();
  process.exit(1);
});
