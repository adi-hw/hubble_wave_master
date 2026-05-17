import { execSync } from 'child_process';
import { writeFileSync, mkdtempSync, rmSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

/**
 * Self-test for the route-boundary-coverage-check scanner. Drives the
 * scanner against tiny fixture controllers that exercise each
 * decision branch in `analyzeHandler`. Each fixture is a single
 * .controller.ts file; the scanner's `--fixtures=path` flag points
 * the project root at the temp dir instead of `apps/api/src` +
 * `apps/control-plane/src`.
 */

function setupFixtureDir(
  controllerContent: string,
  options: {
    registryCodes?: string[];
    allowlistEntries?: Array<{ target: string; rationale: string; addedBy: string; addedAt: string }>;
    controllerFilename?: string;
  } = {},
) {
  const dir = mkdtempSync(join(tmpdir(), 'rbc-'));
  const filename = options.controllerFilename ?? 'x.controller.ts';
  mkdirSync(join(dir, 'src/app'), { recursive: true });
  mkdirSync(join(dir, 'libs/permission-registry/src/lib'), { recursive: true });
  mkdirSync(join(dir, 'tools/scanners'), { recursive: true });

  writeFileSync(join(dir, 'src/app', filename), controllerContent);

  const registryEntries = (options.registryCodes ?? ['audit:read', 'system:admin'])
    .map(
      (c) =>
        `  { code: '${c}', plane: 'instance', domain: 'x', action: 'read', dangerous: false, description: '${c}' },`,
    )
    .join('\n');
  writeFileSync(
    join(dir, 'libs/permission-registry/src/lib/registry.ts'),
    `export const PERMISSION_REGISTRY = [\n${registryEntries}\n];\n`,
  );

  writeFileSync(
    join(dir, 'tools/scanners/route-boundary-coverage-allowlist.json'),
    JSON.stringify({
      $schema: './allowlist-schema.json',
      entries: options.allowlistEntries ?? [],
    }),
  );

  return dir;
}

function runScanner(dir: string, flags = ''): { code: number; stdout: string } {
  try {
    const stdout = execSync(
      `npx tsx tools/scanners/route-boundary-coverage-check.ts --root=${dir} --fixtures=src --ci ${flags}`,
      { encoding: 'utf8' },
    );
    return { code: 0, stdout };
  } catch (e) {
    const err = e as { status?: number; stdout?: Buffer | string };
    return {
      code: err.status ?? 1,
      stdout: err.stdout?.toString() ?? '',
    };
  }
}

function parseResult(stdout: string): {
  handlerCount: number;
  failureCount: number;
  failures: Array<{ reason: string; target: string }>;
} {
  const m = stdout.match(/\{[\s\S]*\}/);
  if (!m) throw new Error(`Could not parse scanner JSON from stdout: ${stdout}`);
  return JSON.parse(m[0]);
}

let assertions = 0;
function assertTrue(condition: boolean, message: string) {
  assertions += 1;
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Fixture 1: good-permission — @RequirePermission with registered code
// ---------------------------------------------------------------------------
{
  const dir = setupFixtureDir(
    `import { Controller, Get } from '@nestjs/common';
import { RequirePermission } from '@hubblewave/auth-guard';

@Controller('x')
export class XController {
  @RequirePermission('audit:read')
  @Get()
  list() { return []; }
}`,
  );
  const r = runScanner(dir);
  const result = parseResult(r.stdout);
  assertTrue(r.code === 0, 'good-permission: exit 0 (reporting-only)');
  assertTrue(result.failureCount === 0, 'good-permission: 0 failures');
  rmSync(dir, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Fixture 2: good-collection — @RequireCollectionAccess
// ---------------------------------------------------------------------------
{
  const dir = setupFixtureDir(
    `import { Controller, Get } from '@nestjs/common';
import { RequireCollectionAccess } from '@hubblewave/auth-guard';

@Controller('x')
export class XController {
  @RequireCollectionAccess({ verb: 'read', collection: { from: 'param', name: 'id', kind: 'id' } })
  @Get(':id')
  one() { return {}; }
}`,
  );
  const r = runScanner(dir);
  const result = parseResult(r.stdout);
  assertTrue(r.code === 0, 'good-collection: exit 0');
  assertTrue(result.failureCount === 0, 'good-collection: 0 failures');
  rmSync(dir, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Fixture 3: good-authenticated — @AuthenticatedOnly
// ---------------------------------------------------------------------------
{
  const dir = setupFixtureDir(
    `import { Controller, Get } from '@nestjs/common';
import { AuthenticatedOnly } from '@hubblewave/auth-guard';

@Controller('x')
export class XController {
  @AuthenticatedOnly()
  @Get('me')
  me() { return {}; }
}`,
  );
  const r = runScanner(dir);
  const result = parseResult(r.stdout);
  assertTrue(r.code === 0, 'good-authenticated: exit 0');
  assertTrue(result.failureCount === 0, 'good-authenticated: 0 failures');
  rmSync(dir, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Fixture 4: good-public — @Public
// ---------------------------------------------------------------------------
{
  const dir = setupFixtureDir(
    `import { Controller, Get } from '@nestjs/common';
import { Public } from '@hubblewave/auth-guard';

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check() { return { status: 'ok' }; }
}`,
  );
  const r = runScanner(dir);
  const result = parseResult(r.stdout);
  assertTrue(r.code === 0, 'good-public: exit 0');
  assertTrue(result.failureCount === 0, 'good-public: 0 failures');
  rmSync(dir, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Fixture 5: bad-unannotated — @Get() with no boundary
// ---------------------------------------------------------------------------
{
  const dir = setupFixtureDir(
    `import { Controller, Get } from '@nestjs/common';

@Controller('x')
export class XController {
  @Get()
  list() { return []; }
}`,
  );
  const r = runScanner(dir);
  const result = parseResult(r.stdout);
  assertTrue(result.failureCount === 1, 'bad-unannotated: 1 failure');
  assertTrue(
    result.failures[0].reason === 'no-primary-boundary',
    'bad-unannotated: no-primary-boundary reason',
  );
  rmSync(dir, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Fixture 6: bad-double-primary — @RequirePermission + @RequireCollectionAccess
// ---------------------------------------------------------------------------
{
  const dir = setupFixtureDir(
    `import { Controller, Get } from '@nestjs/common';
import { RequirePermission, RequireCollectionAccess } from '@hubblewave/auth-guard';

@Controller('x')
export class XController {
  @RequirePermission('audit:read')
  @RequireCollectionAccess({ verb: 'read', collection: { from: 'param', name: 'id', kind: 'id' } })
  @Get(':id')
  one() { return {}; }
}`,
  );
  const r = runScanner(dir);
  const result = parseResult(r.stdout);
  // Multiple primaries triggers BOTH multiple-primary-boundaries AND
  // permission-with-collection-access; the scanner reports both.
  assertTrue(result.failureCount === 2, 'bad-double-primary: 2 failures');
  const reasons = result.failures.map((f) => f.reason).sort();
  assertTrue(
    reasons.includes('multiple-primary-boundaries'),
    'bad-double-primary: multiple-primary-boundaries reason',
  );
  assertTrue(
    reasons.includes('permission-with-collection-access'),
    'bad-double-primary: permission-with-collection-access reason',
  );
  rmSync(dir, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Fixture 7: bad-public-combo — @Public + @RequirePermission
// ---------------------------------------------------------------------------
{
  const dir = setupFixtureDir(
    `import { Controller, Get } from '@nestjs/common';
import { Public, RequirePermission } from '@hubblewave/auth-guard';

@Controller('x')
export class XController {
  @Public()
  @RequirePermission('audit:read')
  @Get()
  list() { return []; }
}`,
  );
  const r = runScanner(dir);
  const result = parseResult(r.stdout);
  const reasons = result.failures.map((f) => f.reason);
  assertTrue(
    reasons.includes('multiple-primary-boundaries'),
    'bad-public-combo: multiple-primary-boundaries reason',
  );
  assertTrue(
    reasons.includes('public-with-other-primary'),
    'bad-public-combo: public-with-other-primary reason',
  );
  rmSync(dir, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Fixture 8: bare-roles — @Roles without a primary boundary
// ---------------------------------------------------------------------------
{
  const dir = setupFixtureDir(
    `import { Controller, Get } from '@nestjs/common';
import { Roles } from '@hubblewave/auth-guard';

@Controller('x')
export class XController {
  @Roles('admin')
  @Get()
  list() { return []; }
}`,
  );
  const r = runScanner(dir);
  const result = parseResult(r.stdout);
  assertTrue(result.failureCount === 1, 'bare-roles: 1 failure');
  assertTrue(
    result.failures[0].reason === 'bare-roles-no-primary',
    'bare-roles: bare-roles-no-primary reason',
  );
  rmSync(dir, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Fixture 9: roles-plus-permission — @Roles is auxiliary, pairs with primary
// ---------------------------------------------------------------------------
{
  const dir = setupFixtureDir(
    `import { Controller, Get } from '@nestjs/common';
import { Roles, RequirePermission } from '@hubblewave/auth-guard';

@Controller('x')
export class XController {
  @Roles('admin')
  @RequirePermission('audit:read')
  @Get()
  list() { return []; }
}`,
  );
  const r = runScanner(dir);
  const result = parseResult(r.stdout);
  assertTrue(result.failureCount === 0, 'roles-plus-permission: 0 failures');
  rmSync(dir, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Fixture 10: unregistered-permission — code not in PERMISSION_REGISTRY
// ---------------------------------------------------------------------------
{
  const dir = setupFixtureDir(
    `import { Controller, Get } from '@nestjs/common';
import { RequirePermission } from '@hubblewave/auth-guard';

@Controller('x')
export class XController {
  @RequirePermission('not.in.registry')
  @Get()
  list() { return []; }
}`,
  );
  const r = runScanner(dir);
  const result = parseResult(r.stdout);
  assertTrue(result.failureCount === 1, 'unregistered-permission: 1 failure');
  assertTrue(
    result.failures[0].reason === 'unregistered-permission',
    'unregistered-permission: unregistered-permission reason',
  );
  rmSync(dir, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Fixture 11: untyped-req — `@Req() req: any`
// ---------------------------------------------------------------------------
{
  const dir = setupFixtureDir(
    `import { Controller, Get, Req } from '@nestjs/common';
import { RequirePermission } from '@hubblewave/auth-guard';

@Controller('x')
export class XController {
  @RequirePermission('audit:read')
  @Get()
  list(@Req() req: any) { return req.user; }
}`,
  );
  const r = runScanner(dir);
  const result = parseResult(r.stdout);
  assertTrue(result.failureCount === 1, 'untyped-req-any: 1 failure');
  assertTrue(
    result.failures[0].reason === 'untyped-req-any',
    'untyped-req-any: untyped-req-any reason',
  );
  rmSync(dir, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Fixture 12: sse-handler — @Sse() decorator counts as an HTTP route
// ---------------------------------------------------------------------------
{
  const dir = setupFixtureDir(
    `import { Controller, Sse } from '@nestjs/common';
import { AuthenticatedOnly } from '@hubblewave/auth-guard';

@Controller('events')
export class EventsController {
  @AuthenticatedOnly()
  @Sse('stream')
  stream() { return {}; }
}`,
  );
  const r = runScanner(dir);
  const result = parseResult(r.stdout);
  assertTrue(r.code === 0, 'sse-handler: exit 0');
  assertTrue(result.handlerCount === 1, 'sse-handler: 1 handler scanned');
  assertTrue(result.failureCount === 0, 'sse-handler: 0 failures');
  rmSync(dir, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Fixture 13: allowlist suppression — allowlisted target reports no failures
// ---------------------------------------------------------------------------
{
  const dir = setupFixtureDir(
    `import { Controller, Get } from '@nestjs/common';

@Controller('x')
export class XController {
  @Get()
  list() { return []; }
}`,
    {
      allowlistEntries: [
        {
          target: 'XController.list',
          rationale: 'self-test allowlist',
          addedBy: 'selftest',
          addedAt: '2026-05-17',
        },
      ],
    },
  );
  const r = runScanner(dir);
  const result = parseResult(r.stdout);
  assertTrue(result.failureCount === 0, 'allowlist suppression: 0 failures');
  rmSync(dir, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Fixture 14: --strict mode — exits 1 on any failure
// ---------------------------------------------------------------------------
{
  const dir = setupFixtureDir(
    `import { Controller, Get } from '@nestjs/common';

@Controller('x')
export class XController {
  @Get()
  list() { return []; }
}`,
  );
  const r = runScanner(dir, '--strict');
  assertTrue(r.code === 1, '--strict + failure: exits 1');
  rmSync(dir, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Fixture 15: method-level primary overrides class-level
// ---------------------------------------------------------------------------
{
  const dir = setupFixtureDir(
    `import { Controller, Get } from '@nestjs/common';
import { RequirePermission, Public } from '@hubblewave/auth-guard';

@Public()
@Controller('x')
export class XController {
  @RequirePermission('audit:read')
  @Get('secret')
  secret() { return {}; }
}`,
  );
  const r = runScanner(dir);
  const result = parseResult(r.stdout);
  // Method-level @RequirePermission overrides class-level @Public for
  // the effective primary set — no combo failure.
  assertTrue(
    result.failureCount === 0,
    'method-level overrides class-level: 0 failures',
  );
  rmSync(dir, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Fixture 16: AuthenticatedOnly + Roles — explicit conflict
// ---------------------------------------------------------------------------
{
  const dir = setupFixtureDir(
    `import { Controller, Get } from '@nestjs/common';
import { AuthenticatedOnly, Roles } from '@hubblewave/auth-guard';

@Controller('x')
export class XController {
  @AuthenticatedOnly()
  @Roles('admin')
  @Get()
  list() { return []; }
}`,
  );
  const r = runScanner(dir);
  const result = parseResult(r.stdout);
  const reasons = result.failures.map((f) => f.reason);
  assertTrue(
    reasons.includes('authenticated-only-with-roles-or-permission'),
    'AuthenticatedOnly + Roles: authenticated-only-with-roles-or-permission reason',
  );
  rmSync(dir, { recursive: true, force: true });
}

console.log(`route-boundary-coverage selftest: ${assertions}/${assertions} assertions`);
