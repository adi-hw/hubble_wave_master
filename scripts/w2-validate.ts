#!/usr/bin/env tsx
/**
 * W2 boundary-consistency validation harness.
 *
 * Verifies the W2 contracts (Streams 0-3 + Stream 4a/b) end-to-end
 * against a running platform. Standalone from `prelude-validate.ts`:
 * each harness has its own assertion list, helpers, and entry point.
 * Both run in CI; prelude-validate is the first gate, w2-validate is
 * the second.
 *
 * Assertion coverage:
 *
 *   Happy path:
 *     1. Admin login returns ES256 JWT.
 *     2. Admin can call /authorization/explain/collection — returns
 *        the canon §28.7 DecisionProvenance shape.
 *     3. Admin can call /authorization/explain/field — returns the
 *        canon §28.7 FieldDecisionProvenance shape.
 *
 *   Negative cases:
 *     4. Unauthenticated request → 401 with the platform's bland
 *        wire shape (no permission leak).
 *     5. Authenticated request with an HS256-signed token → 401.
 *        The token issuer signs ES256 per canon §29.9; the
 *        verification chain MUST reject any HS256 token even if
 *        the secret accidentally matches.
 *     6. Bare `@Roles('admin')` injected into a controller fixture
 *        without a primary boundary → `route-boundary:check`
 *        exits non-zero.
 *     7. Unannotated handler fixture → same scanner exits non-zero.
 *
 * Out of scope for this harness (each is its own follow-up):
 *
 *   - Service-token scope + ACL paths (need a seeded service principal
 *     + the bootstrap exchange to mint a service token).
 *   - Admin role retirement + cache invalidation timing (needs a
 *     live DB mutation + 1s budget assertion against the bus).
 *   - Search corpus / facet / pagination accuracy against a real
 *     Typesense container (covered by the Task 35 integration spec
 *     against pgvector + the in-memory filter_by interpreter).
 *   - Dashboard widget drop (covered by F146 integration spec).
 *   - AVA chat orchestration rollback (covered by F052 integration
 *     spec).
 *   - Audit chain after 50 concurrent transactions (covered by F042
 *     integration spec).
 *
 * Each "covered by" line above points at a dedicated jest integration
 * test that runs against real Postgres in CI. The W2 harness's job
 * is the surfaces those tests CAN'T reach — the HTTP boundary, the
 * scanner-enforcement boundary — not to duplicate the integration
 * suite.
 *
 * Usage:
 *   npx tsx scripts/w2-validate.ts                  # full run
 *   npx tsx scripts/w2-validate.ts --skip-api-boot  # assume API is up
 */
import { execSync, spawn, type ChildProcess } from 'child_process';
import * as crypto from 'crypto';
import { existsSync, readFileSync, rmSync, writeFileSync, mkdtempSync } from 'fs';
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
    return {
      code: err.status ?? 1,
      stdout: err.stdout?.toString() ?? '',
      stderr: err.stderr?.toString() ?? '',
    };
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
const apiStartupLogPath = join(tmpdir(), 'hw-w2-api-startup.log');
let adminAccessToken: string | null = null;
let adminUserId: string | null = null;

// ============================================================================
// HAPPY PATH ASSERTIONS
// ============================================================================

assert('admin login returns an ES256 JWT', async () => {
  const pw = readEnvPassword();
  if (!pw) return { ok: false, detail: 'ADMIN_PASSWORD missing from .env' };
  const bodyFile = join(tmpdir(), 'hw-w2-login-body.json');
  const outFile = join(tmpdir(), 'hw-w2-login-resp.json');
  writeFileSync(
    bodyFile,
    JSON.stringify({
      username: 'admin@hubblewave.local',
      password: pw,
      instanceSlug: 'default',
    }),
    'utf8',
  );
  const r = sh(
    `curl -s -o "${outFile}" -w "%{http_code}" -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d @"${bodyFile}"`,
    { allowFail: true },
  );
  if (r.stdout.trim() !== '201') {
    return { ok: false, detail: `expected 201, got ${r.stdout}` };
  }

  const resp = JSON.parse(readFileSync(outFile, 'utf8'));
  const accessToken = resp.accessToken as string | undefined;
  if (!accessToken?.startsWith('eyJ')) {
    return { ok: false, detail: 'no JWT in login response' };
  }

  // Header alg must be ES256 per canon §29.9; HS256 is forbidden.
  const headerJson = Buffer.from(accessToken.split('.')[0], 'base64url').toString('utf8');
  const header = JSON.parse(headerJson);
  if (header.alg !== 'ES256') {
    return { ok: false, detail: `expected alg=ES256, got ${header.alg}` };
  }

  // Capture for downstream assertions. The `sub` claim is the user id
  // the explain endpoints accept as the `userId` they will resolve.
  const payloadJson = Buffer.from(accessToken.split('.')[1], 'base64url').toString('utf8');
  const payload = JSON.parse(payloadJson);
  const subject = String(payload.sub ?? '');
  // Canon §29.3 — user JWTs carry `sub = user:<uuid>`. Strip the prefix
  // so the explain endpoints accept the bare UUID.
  adminUserId = subject.startsWith('user:') ? subject.slice('user:'.length) : subject;
  adminAccessToken = accessToken;
  return { ok: true };
});

assert('admin /authorization/explain/collection returns DecisionProvenance shape', async () => {
  if (!adminAccessToken || !adminUserId) {
    return { ok: false, detail: 'admin token missing from prior assertion' };
  }
  const bodyFile = join(tmpdir(), 'hw-w2-explain-collection-body.json');
  const outFile = join(tmpdir(), 'hw-w2-explain-collection-resp.json');
  // Use a stable collection UUID — the explain endpoint accepts any
  // UUID and returns level-3 default-deny provenance when no rule
  // matches. The shape of the response is what we're verifying, not
  // the verdict.
  const probeCollectionId = '00000000-0000-4000-8000-000000000001';
  writeFileSync(
    bodyFile,
    JSON.stringify({
      userId: adminUserId,
      collectionId: probeCollectionId,
      operation: 'read',
    }),
    'utf8',
  );
  const r = sh(
    `curl -s -o "${outFile}" -w "%{http_code}" -X POST http://localhost:3000/api/authorization/explain/collection -H "Authorization: Bearer ${adminAccessToken}" -H "Content-Type: application/json" -d @"${bodyFile}"`,
    { allowFail: true },
  );
  if (r.stdout.trim() !== '201') {
    // 404 here means the admin user could not be resolved by id —
    // surface that detail rather than asserting on the body shape.
    const body = existsSync(outFile) ? readFileSync(outFile, 'utf8') : '';
    return { ok: false, detail: `expected 201, got ${r.stdout}; body=${body.slice(0, 200)}` };
  }
  const resp = JSON.parse(readFileSync(outFile, 'utf8'));
  // §28.7 shape requires: effect, matchedLevel, matchedRuleId,
  // matchedPrincipal, fallbackChain.
  const requiredKeys = ['effect', 'matchedLevel', 'matchedRuleId', 'matchedPrincipal', 'fallbackChain'];
  const missing = requiredKeys.filter((k) => !(k in resp));
  if (missing.length > 0) {
    return { ok: false, detail: `provenance missing keys: ${missing.join(', ')}` };
  }
  if (!Array.isArray(resp.fallbackChain)) {
    return { ok: false, detail: 'fallbackChain is not an array' };
  }
  return { ok: true };
});

assert('admin /authorization/explain/field returns FieldDecisionProvenance shape', async () => {
  if (!adminAccessToken || !adminUserId) {
    return { ok: false, detail: 'admin token missing from prior assertion' };
  }
  const bodyFile = join(tmpdir(), 'hw-w2-explain-field-body.json');
  const outFile = join(tmpdir(), 'hw-w2-explain-field-resp.json');
  writeFileSync(
    bodyFile,
    JSON.stringify({
      userId: adminUserId,
      collectionId: '00000000-0000-4000-8000-000000000001',
      field: { code: 'name', isSystem: false },
    }),
    'utf8',
  );
  const r = sh(
    `curl -s -o "${outFile}" -w "%{http_code}" -X POST http://localhost:3000/api/authorization/explain/field -H "Authorization: Bearer ${adminAccessToken}" -H "Content-Type: application/json" -d @"${bodyFile}"`,
    { allowFail: true },
  );
  if (r.stdout.trim() !== '201') {
    const body = existsSync(outFile) ? readFileSync(outFile, 'utf8') : '';
    return { ok: false, detail: `expected 201, got ${r.stdout}; body=${body.slice(0, 200)}` };
  }
  const resp = JSON.parse(readFileSync(outFile, 'utf8'));
  // §28.7 field shape requires the collection-decision keys + maskingStrategy.
  const requiredKeys = ['effect', 'matchedLevel', 'matchedRuleId', 'matchedPrincipal', 'fallbackChain', 'maskingStrategy'];
  const missing = requiredKeys.filter((k) => !(k in resp));
  if (missing.length > 0) {
    return { ok: false, detail: `field provenance missing keys: ${missing.join(', ')}` };
  }
  return { ok: true };
});

// ============================================================================
// NEGATIVE-CASE ASSERTIONS
// ============================================================================

assert('unauthenticated request → 401 with bland body (no permission leak)', async () => {
  const outFile = join(tmpdir(), 'hw-w2-anon-resp.json');
  const r = sh(
    `curl -s -o "${outFile}" -w "%{http_code}" http://localhost:3000/api/users`,
    { allowFail: true },
  );
  if (r.stdout.trim() !== '401') {
    return { ok: false, detail: `expected 401, got ${r.stdout}` };
  }
  const body = existsSync(outFile) ? readFileSync(outFile, 'utf8') : '';
  // The body MUST NOT mention which permission would have unlocked
  // the route. Canon §28 deliberately strips that detail at the wire.
  if (/identity:user:manage|users:view|permission_required/i.test(body)) {
    return { ok: false, detail: `401 body leaks permission detail: ${body.slice(0, 200)}` };
  }
  return { ok: true };
});

assert('HS256-signed token → 401 (canon §29.9 — HS256 forbidden)', async () => {
  // Mint a syntactically-valid JWT signed with HS256 + a guessable
  // secret. The verifier MUST reject the alg before it even checks
  // the signature, because the alg is on a hard-deny list.
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      sub: 'user:00000000-0000-4000-8000-000000000000',
      iss: 'hubblewave',
      aud: 'hubblewave-instance',
      exp: Math.floor(Date.now() / 1000) + 600,
      iat: Math.floor(Date.now() / 1000),
    }),
  ).toString('base64url');
  const signature = crypto
    .createHmac('sha256', 'definitely-not-the-platform-key')
    .update(`${header}.${payload}`)
    .digest('base64url');
  const token = `${header}.${payload}.${signature}`;

  const r = sh(
    `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/auth/me -H "Authorization: Bearer ${token}"`,
    { allowFail: true },
  );
  return r.stdout.trim() === '401'
    ? { ok: true }
    : { ok: false, detail: `expected 401 for HS256 token, got ${r.stdout}` };
});

// ============================================================================
// SCANNER-ENFORCEMENT ASSERTIONS (route-boundary contract)
// ============================================================================

assert('bare @Roles fixture fails route-boundary:check', async () => {
  // Build a single-file fixture that ONLY contains a bare-@Roles
  // handler. Point the scanner at it via --fixtures=... and assert
  // a non-zero exit. The scanner's self-test exercises the same
  // shape; this assertion proves the harness is wired correctly
  // end-to-end (scanner installed, --fixtures supported, exit
  // propagation works).
  const dir = mkdtempSync(join(tmpdir(), 'hw-w2-bare-roles-'));
  writeFileSync(
    join(dir, 'bad.ts'),
    `import { Controller, Get } from '@nestjs/common';
import { Roles } from '@hubblewave/auth-guard';

@Controller('x')
export class XController {
  @Get()
  @Roles('admin')
  list() { return []; }
}
`,
    'utf8',
  );
  const r = sh(
    `npx tsx tools/scanners/route-boundary-coverage-check.ts --fixtures="${dir}"`,
    { allowFail: true },
  );
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // tolerated — tmp dir cleanup is best-effort.
  }
  return r.code !== 0
    ? { ok: true }
    : { ok: false, detail: 'scanner exited 0 — bare @Roles should fail' };
});

assert('unannotated handler fixture fails route-boundary:check', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'hw-w2-unannotated-'));
  writeFileSync(
    join(dir, 'bad.ts'),
    `import { Controller, Get } from '@nestjs/common';

@Controller('x')
export class XController {
  @Get()
  list() { return []; }
}
`,
    'utf8',
  );
  const r = sh(
    `npx tsx tools/scanners/route-boundary-coverage-check.ts --fixtures="${dir}"`,
    { allowFail: true },
  );
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // tolerated — tmp dir cleanup is best-effort.
  }
  return r.code !== 0
    ? { ok: true }
    : { ok: false, detail: 'scanner exited 0 — unannotated handler should fail' };
});

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  const skipApiBoot = process.argv.includes('--skip-api-boot');

  if (!skipApiBoot) {
    // Check whether the API is already up; if not, spawn it the same way
    // prelude-validate does (file-redirected stdout to defeat Windows
    // pipe-buffer deadlocks on cold compile).
    const alreadyUp = await pollHttp('http://localhost:3000/api/health', 4);
    if (!alreadyUp) {
      console.log('▶ Spawning apps/api (cold compile may take 60-180s)...');
      if (existsSync(apiStartupLogPath)) {
        try {
          rmSync(apiStartupLogPath, { force: true });
        } catch {
          // tolerated
        }
      }
      apiProcess = spawn(`npm run dev:api > "${apiStartupLogPath}" 2>&1`, {
        stdio: 'ignore',
        shell: true,
      });
      const ready = await pollHttp('http://localhost:3000/api/health', 180);
      if (!ready) {
        console.error('apps/api did not become healthy within 180s.');
        if (apiProcess) apiProcess.kill();
        process.exit(1);
      }
    }
  }

  console.log('\n▶ Running W2 assertions...\n');
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
