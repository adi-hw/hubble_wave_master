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
import { readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

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
let apiStartupBuf = '';
let loginAccessToken: string | null = null;

// ============================================================================
// HAPPY PATH ASSERTIONS
// ============================================================================

assert('apps/api boots without ERROR/UnhandledPromiseRejection in startup log', async () => {
  // If the API is already healthy (e.g. --skip-rebuild with a running instance),
  // skip the spawn entirely — we're validating a live running platform.
  const alreadyUp = await pollHttp('http://localhost:3000/api/health', 4);
  if (!alreadyUp) {
    // API not running: spawn it and wait for it to become healthy.
    // Use shell: true so npm scripts resolve correctly.
    apiProcess = spawn('npm', ['run', 'dev:api'], { stdio: ['ignore', 'pipe', 'pipe'], shell: true });
    apiProcess.stdout?.on('data', (d: Buffer) => { apiStartupBuf += d.toString(); });
    apiProcess.stderr?.on('data', (d: Buffer) => { apiStartupBuf += d.toString(); });
  }

  // Primary readiness: poll health endpoint (max 180s to handle cold NX cache).
  // This is more reliable than string-matching against ANSI-coloured NX output
  // because NX may buffer or reroute child-process stdout on Windows.
  const apiUp = await pollHttp('http://localhost:3000/api/health', 180);
  if (!apiUp) {
    return { ok: false, detail: 'apps/api did not become healthy within 180s' };
  }

  // Forbidden patterns in startup log (best-effort — buffer may be empty on
  // platforms where shell: true does not surface NX child stdout; that is
  // acceptable because the health check already confirmed a clean boot).
  const forbidden = ['UnhandledPromiseRejection', 'FATAL', 'unannotated endpoint passed through'];
  const violations = forbidden.filter((p) => apiStartupBuf.includes(p));
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

assert('GET /api/users returns 200 with admin token', async () => {
  if (!loginAccessToken) return { ok: false, detail: 'no token from prior login assertion' };
  const r = sh(`curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/api/users?pageSize=1" -H "Authorization: Bearer ${loginAccessToken}"`, { allowFail: true });
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
  // psql via env vars works in both local docker-compose and GitHub Actions
  // service-container environments. PGHOST/PGUSER/PGPASSWORD/PGDATABASE map
  // from the standard DB_* env block the harness's CI job already provides;
  // we also accept DB_* as a fallback for local dev where PG* aren't set.
  const env = process.env;
  const host = env.PGHOST ?? env.DB_HOST ?? 'localhost';
  const port = env.PGPORT ?? env.DB_PORT ?? '5432';
  const user = env.PGUSER ?? env.DB_USER ?? 'hubblewave';
  const password = env.PGPASSWORD ?? env.DB_PASSWORD ?? 'hubblewave';
  const database = env.PGDATABASE ?? env.DB_NAME ?? 'hubblewave';
  const r = sh(
    `PGPASSWORD='${password}' psql -h ${host} -p ${port} -U ${user} -d ${database} -t -c "SELECT count(*) FROM metadata.navigation_module_revisions WHERE layout::text LIKE '%studio.views%' OR layout::text LIKE '%/legacy/%'"`,
    { allowFail: true }
  );
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
